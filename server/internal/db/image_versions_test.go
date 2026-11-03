package db

import (
	"context"
	"testing"
	"time"
)

// Image responses are cached as immutable, so a replaced picture must
// come with a new version (clients put it in the image URL).
func TestAvatarVersionChangesOnReplace(t *testing.T) {
	pool := testPool(t)
	ctx := context.Background()
	owner := testUser(t, pool, "owner")
	clubID := testClub(t, pool, owner, "public")

	user, err := GetUserByID(ctx, pool, owner)
	if err != nil {
		t.Fatal(err)
	}
	if user.HasAvatar || user.AvatarVersion != nil {
		t.Fatalf("new user: hasAvatar=%v version=%v, want none", user.HasAvatar, user.AvatarVersion)
	}

	first, err := UploadUserAvatar(ctx, pool, owner, []byte("one"), "image/png")
	if err != nil {
		t.Fatal(err)
	}
	time.Sleep(5 * time.Millisecond)
	second, err := UploadUserAvatar(ctx, pool, owner, []byte("two"), "image/png")
	if err != nil {
		t.Fatal(err)
	}
	if first.AvatarVersion == nil || second.AvatarVersion == nil || *first.AvatarVersion == *second.AvatarVersion {
		t.Fatalf("user avatar versions %v then %v, want two different versions", first.AvatarVersion, second.AvatarVersion)
	}

	members, err := ListMembers(ctx, pool, clubID)
	if err != nil {
		t.Fatal(err)
	}
	if len(members) != 1 || members[0].AvatarVersion == nil || *members[0].AvatarVersion != *second.AvatarVersion {
		t.Fatalf("member list should carry the latest avatar version %d, got %+v", *second.AvatarVersion, members)
	}

	c1, err := UploadClubAvatar(ctx, pool, clubID, []byte("one"), "image/png")
	if err != nil {
		t.Fatal(err)
	}
	time.Sleep(5 * time.Millisecond)
	c2, err := UploadClubAvatar(ctx, pool, clubID, []byte("two"), "image/png")
	if err != nil {
		t.Fatal(err)
	}
	if c1.AvatarVersion == nil || c2.AvatarVersion == nil || *c1.AvatarVersion == *c2.AvatarVersion {
		t.Fatalf("club avatar versions %v then %v, want two different versions", c1.AvatarVersion, c2.AvatarVersion)
	}
}
