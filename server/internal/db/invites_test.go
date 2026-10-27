package db

import (
	"context"
	"errors"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
)

// testClub makes a Club with the given visibility, owned by owner.
func testClub(t *testing.T, pool *pgxpool.Pool, owner, visibility string) string {
	t.Helper()
	ctx := context.Background()
	var clubID string
	if err := pool.QueryRow(ctx,
		"INSERT INTO clubs (name, invite_code, created_by, visibility) VALUES ($1, $2, $3, $4) RETURNING id",
		"Invite test "+t.Name(), "IT-"+owner[:8], owner, visibility,
	).Scan(&clubID); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { pool.Exec(ctx, "DELETE FROM clubs WHERE id = $1", clubID) })
	testMember(t, pool, clubID, owner, "owner")
	return clubID
}

func testMember(t *testing.T, pool *pgxpool.Pool, clubID, userID, role string) {
	t.Helper()
	if _, err := pool.Exec(context.Background(),
		`INSERT INTO club_members (club_id, user_id, role) VALUES ($1, $2, $3)
		 ON CONFLICT (club_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
		clubID, userID, role,
	); err != nil {
		t.Fatal(err)
	}
}

func TestInviteLinks(t *testing.T) {
	pool := testPool(t)
	ctx := context.Background()
	owner := testUser(t, pool, "owner")
	member := testUser(t, pool, "member")
	clubID := testClub(t, pool, owner, "public")
	testMember(t, pool, clubID, member, "member")

	t.Run("one link per inviter per target", func(t *testing.T) {
		a, err := GetOrCreateInviteLink(ctx, pool, InviteTargetClub, clubID, clubID, member)
		if err != nil {
			t.Fatal(err)
		}
		again, err := GetOrCreateInviteLink(ctx, pool, InviteTargetClub, clubID, clubID, member)
		if err != nil {
			t.Fatal(err)
		}
		if a.Token != again.Token {
			t.Fatalf("second call made a new link: %q then %q", a.Token, again.Token)
		}
		if len(a.Token) != 22 {
			t.Fatalf("token %q is %d characters, want 22", a.Token, len(a.Token))
		}
		other, err := GetOrCreateInviteLink(ctx, pool, InviteTargetClub, clubID, clubID, owner)
		if err != nil {
			t.Fatal(err)
		}
		if other.Token == a.Token {
			t.Fatal("two inviters share a link")
		}
	})

	t.Run("reset revokes every link and the next one is fresh", func(t *testing.T) {
		before, _ := GetOrCreateInviteLink(ctx, pool, InviteTargetClub, clubID, clubID, member)
		n, err := ResetInviteLinks(ctx, pool, InviteTargetClub, clubID)
		if err != nil {
			t.Fatal(err)
		}
		if n != 2 {
			t.Fatalf("reset revoked %d links, want 2 (owner's and member's)", n)
		}
		if _, err := GetInviteLink(ctx, pool, before.Token); !errors.Is(err, ErrInviteRevoked) {
			t.Fatalf("old token: got %v, want ErrInviteRevoked", err)
		}
		after, err := GetOrCreateInviteLink(ctx, pool, InviteTargetClub, clubID, clubID, member)
		if err != nil {
			t.Fatal(err)
		}
		if after.Token == before.Token {
			t.Fatal("reset kept the same token")
		}
		if _, err := GetInviteLink(ctx, pool, after.Token); err != nil {
			t.Fatalf("new token: %v", err)
		}
	})

	t.Run("an unknown token is not found", func(t *testing.T) {
		if _, err := GetInviteLink(ctx, pool, "nope"); !errors.Is(err, ErrNotFound) {
			t.Fatalf("got %v, want ErrNotFound", err)
		}
	})
}

func TestInviteStraightIn(t *testing.T) {
	pool := testPool(t)
	ctx := context.Background()
	owner := testUser(t, pool, "owner")
	admin := testUser(t, pool, "admin")
	member := testUser(t, pool, "member")
	friend := testUser(t, pool, "friend")
	clubID := testClub(t, pool, owner, "private")
	testMember(t, pool, clubID, admin, "admin")
	testMember(t, pool, clubID, member, "member")

	invite := func(from string) {
		t.Helper()
		link, err := GetOrCreateInviteLink(ctx, pool, InviteTargetClub, clubID, clubID, from)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := RecordInvitation(ctx, pool, from, friend, InviteTargetClub, clubID, clubID, "link", &link.Token); err != nil {
			t.Fatal(err)
		}
	}
	straightIn := func() bool {
		t.Helper()
		ok, err := HasOrganizerInvite(ctx, pool, clubID, friend)
		if err != nil {
			t.Fatal(err)
		}
		return ok
	}

	t.Run("a plain member's invite doesn't skip approval", func(t *testing.T) {
		invite(member)
		if straightIn() {
			t.Fatal("member's invite skipped approval")
		}
		if out, err := JoinClub(ctx, pool, clubID, friend, straightIn()); err != nil || out != JoinRequested {
			t.Fatalf("JoinClub = %v, %v; want a request", out, err)
		}
		pool.Exec(ctx, "DELETE FROM club_join_requests WHERE club_id = $1 AND user_id = $2", clubID, friend)
	})

	t.Run("an admin's invite skips approval", func(t *testing.T) {
		invite(admin)
		if !straightIn() {
			t.Fatal("admin's invite should skip approval")
		}
	})

	t.Run("checked when used: a demoted admin's invite stops skipping", func(t *testing.T) {
		testMember(t, pool, clubID, admin, "member")
		if straightIn() {
			t.Fatal("demoted admin's invite still skips approval")
		}
		testMember(t, pool, clubID, admin, "admin")
	})

	t.Run("a reset link stops skipping", func(t *testing.T) {
		if _, err := ResetInviteLinks(ctx, pool, InviteTargetClub, clubID); err != nil {
			t.Fatal(err)
		}
		if straightIn() {
			t.Fatal("an invite through a reset link still skips approval")
		}
	})

	t.Run("an in-app invite from the owner lets them straight in", func(t *testing.T) {
		if _, err := RecordInvitation(ctx, pool, owner, friend, InviteTargetClub, clubID, clubID, "app", nil); err != nil {
			t.Fatal(err)
		}
		if out, err := JoinClub(ctx, pool, clubID, friend, straightIn()); err != nil || out != JoinJoined {
			t.Fatalf("JoinClub = %v, %v; want joined", out, err)
		}
	})
}
