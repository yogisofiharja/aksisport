package httpapi

import (
	"net"
	"net/http"
	"strings"
)

// ClientIPResolver works out which address a request really came from,
// for rate limiting. In production the chain is browser -> Cloudflare ->
// Caddy (on this machine) -> API, so the TCP peer is always Caddy and
// Caddy's own X-Forwarded-For only ever names a Cloudflare edge — both
// useless as a per-person key. Cloudflare puts the visitor's address in
// CF-Connecting-IP; that header is believed only when the request reached
// the API through a trusted proxy (Caddy), since anyone connecting
// directly could set it to anything.
type ClientIPResolver struct {
	// Header carrying the original client address, e.g. CF-Connecting-IP.
	// Empty: always use the TCP peer (local development).
	Header string
	// TrustedProxies are the peers whose Header is believed.
	TrustedProxies []net.IP
}

// ParseTrustedProxies reads a comma-separated list of IPs, skipping
// anything that isn't one.
func ParseTrustedProxies(list string) []net.IP {
	var ips []net.IP
	for _, part := range strings.Split(list, ",") {
		if ip := net.ParseIP(strings.TrimSpace(part)); ip != nil {
			ips = append(ips, ip)
		}
	}
	return ips
}

func (r ClientIPResolver) ClientIP(req *http.Request) string {
	peer := req.RemoteAddr
	if host, _, err := net.SplitHostPort(peer); err == nil {
		peer = host
	}
	if r.Header == "" || !r.trusted(net.ParseIP(peer)) {
		return peer
	}
	if forwarded := net.ParseIP(strings.TrimSpace(req.Header.Get(r.Header))); forwarded != nil {
		return forwarded.String()
	}
	return peer
}

func (r ClientIPResolver) trusted(ip net.IP) bool {
	if ip == nil {
		return false
	}
	for _, p := range r.TrustedProxies {
		if p.Equal(ip) {
			return true
		}
	}
	return false
}
