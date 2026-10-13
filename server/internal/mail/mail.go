// Package mail is the seam between the app and whichever provider ends up
// sending its email (DP-015 leaves that undecided). Everything that needs
// to send depends on Mailer; adding a provider means adding one
// implementation here and choosing it in cmd/api/main.go.
package mail

import (
	"context"
	"fmt"
	"log"
)

type Message struct {
	To      string
	Subject string
	Body    string // plain text
}

type Mailer interface {
	Send(ctx context.Context, msg Message) error
}

// LogMailer "sends" by writing the message to the server log. It is what
// runs until a real provider is configured, and it is how a code is read
// during local development.
type LogMailer struct{}

func (LogMailer) Send(_ context.Context, msg Message) error {
	log.Printf("[mail not configured — logging instead] to=%s subject=%q\n%s", msg.To, msg.Subject, msg.Body)
	return nil
}

// Both messages are bilingual (English, then Indonesian): the server does
// not know which language the recipient's app is set to.

func VerificationMessage(to, code string) Message {
	return Message{
		To:      to,
		Subject: fmt.Sprintf("%s is your Aksi confirmation code", code),
		Body: fmt.Sprintf(`Your Aksi confirmation code is %s

Enter it in the app to confirm this email address. The code is valid for 15 minutes.
If you did not ask for this, you can ignore this email.

---

Kode konfirmasi Aksi kamu adalah %s

Masukkan kode ini di aplikasi untuk mengonfirmasi alamat email ini. Kode berlaku 15 menit.
Jika kamu tidak memintanya, abaikan email ini.
`, code, code),
	}
}

func PasswordResetMessage(to, code string) Message {
	return Message{
		To:      to,
		Subject: fmt.Sprintf("%s is your Aksi password reset code", code),
		Body: fmt.Sprintf(`Your Aksi password reset code is %s

Enter it in the app to choose a new password. The code is valid for 15 minutes.
If you did not ask for this, you can ignore this email — your password stays the same.

---

Kode reset kata sandi Aksi kamu adalah %s

Masukkan kode ini di aplikasi untuk membuat kata sandi baru. Kode berlaku 15 menit.
Jika kamu tidak memintanya, abaikan email ini — kata sandimu tidak berubah.
`, code, code),
	}
}

// The two notices below carry no code and ask for nothing. They exist so
// the account owner hears about a change even if someone else made it.

func PasswordChangedMessage(to string) Message {
	return Message{
		To:      to,
		Subject: "Your Aksi password was changed",
		Body: `The password for your Aksi account was just changed.

If this was you, there is nothing more to do.
If it was not you, reset your password now from the login screen ("Forgot password?").

---

Kata sandi akun Aksi kamu baru saja diganti.

Jika ini kamu, tidak ada yang perlu dilakukan.
Jika bukan kamu, segera atur ulang kata sandi dari layar masuk ("Lupa kata sandi?").
`,
	}
}

// EmailChangedMessage goes to the address that was just replaced — the
// only place the previous owner of the account would still see it.
func EmailChangedMessage(oldEmail, newEmail string) Message {
	return Message{
		To:      oldEmail,
		Subject: "Your Aksi email address was changed",
		Body: fmt.Sprintf(`The email address on your Aksi account was changed from %s to %s.

If this was you, there is nothing more to do. Aksi will no longer send email to this address.
If it was not you, someone else has access to your account: log in, change your password, and set your email back.

---

Alamat email akun Aksi kamu diganti dari %s menjadi %s.

Jika ini kamu, tidak ada yang perlu dilakukan. Aksi tidak akan lagi mengirim email ke alamat ini.
Jika bukan kamu, ada orang lain yang bisa mengakses akunmu: masuk, ganti kata sandi, lalu kembalikan alamat emailmu.
`, oldEmail, newEmail, oldEmail, newEmail),
	}
}
