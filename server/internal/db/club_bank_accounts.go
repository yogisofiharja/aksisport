package db

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yogisofiharja/aksi-server/internal/models"
)

const clubBankAccountColumns = "id, club_id, bank_name, account_number, account_name, created_at"

func scanClubBankAccount(row pgx.CollectableRow) (models.ClubBankAccount, error) {
	var a models.ClubBankAccount
	err := row.(pgx.Rows).Scan(&a.ID, &a.ClubID, &a.BankName, &a.AccountNumber, &a.AccountName, &a.CreatedAt)
	return a, err
}

// ListClubBankAccounts returns every bank account a Club has listed,
// oldest first — a Club owner can list more than one (Milestone 5).
func ListClubBankAccounts(ctx context.Context, pool *pgxpool.Pool, clubID string) ([]models.ClubBankAccount, error) {
	rows, err := pool.Query(ctx, "SELECT "+clubBankAccountColumns+" FROM club_bank_accounts WHERE club_id = $1 ORDER BY created_at ASC", clubID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := []models.ClubBankAccount{}
	for rows.Next() {
		a, err := scanClubBankAccount(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, a)
	}
	return result, rows.Err()
}

func CreateClubBankAccount(ctx context.Context, pool *pgxpool.Pool, clubID, bankName, accountNumber, accountName string) (models.ClubBankAccount, error) {
	rows, err := pool.Query(ctx,
		"INSERT INTO club_bank_accounts (club_id, bank_name, account_number, account_name) VALUES ($1, $2, $3, $4) RETURNING "+clubBankAccountColumns,
		clubID, bankName, accountNumber, accountName,
	)
	if err != nil {
		return models.ClubBankAccount{}, err
	}
	defer rows.Close()
	return pgx.CollectOneRow(rows, scanClubBankAccount)
}

func UpdateClubBankAccount(ctx context.Context, pool *pgxpool.Pool, clubID, accountID string, bankName, accountNumber, accountName *string) (models.ClubBankAccount, error) {
	rows, err := pool.Query(ctx,
		`UPDATE club_bank_accounts SET
			bank_name = COALESCE($3, bank_name),
			account_number = COALESCE($4, account_number),
			account_name = COALESCE($5, account_name)
		 WHERE id = $1 AND club_id = $2
		 RETURNING `+clubBankAccountColumns,
		accountID, clubID, bankName, accountNumber, accountName,
	)
	if err != nil {
		return models.ClubBankAccount{}, err
	}
	defer rows.Close()
	a, err := pgx.CollectOneRow(rows, scanClubBankAccount)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.ClubBankAccount{}, ErrNotFound
	}
	return a, err
}

func DeleteClubBankAccount(ctx context.Context, pool *pgxpool.Pool, clubID, accountID string) error {
	tag, err := pool.Exec(ctx, "DELETE FROM club_bank_accounts WHERE id = $1 AND club_id = $2", accountID, clubID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}
