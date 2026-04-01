package instance

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/telemt/telemt-panel/internal/config"
)

// Instance represents a Telemt server instance with its HTTP client.
type Instance struct {
	Name        string
	URL         string
	AuthHeader  string
	BinaryPath  string
	ServiceName string
	GithubRepo  string
	ConfigPath  string
	ContainerName string
	client      *http.Client
}

// Manager holds all configured Telemt instances and provides methods to access them.
type Manager struct {
	mu        sync.RWMutex
	instances map[string]*Instance
}

// SystemInfo represents Telemt system information.
type SystemInfo struct {
	ConfigPath string `json:"config_path"`
	ConfigHash string `json:"config_hash"`
}

// NewManager creates a new instance manager from config.
func NewManager(cfgs []config.TelemtInstance) *Manager {
	m := &Manager{
		instances: make(map[string]*Instance),
	}
	for _, c := range cfgs {
		m.instances[c.Name] = &Instance{
			Name:          c.Name,
			URL:           c.URL,
			AuthHeader:    c.AuthHeader,
			BinaryPath:    c.BinaryPath,
			ServiceName:   c.ServiceName,
			GithubRepo:    c.GithubRepo,
			ConfigPath:    c.ConfigPath,
			ContainerName: c.ContainerName,
			client: &http.Client{
				Timeout: 10 * time.Second,
			},
		}
	}
	return m
}

// Get returns an instance by name, or nil if not found.
func (m *Manager) Get(name string) *Instance {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.instances[name]
}

// GetAll returns all instances.
func (m *Manager) GetAll() []*Instance {
	m.mu.RLock()
	defer m.mu.RUnlock()
	result := make([]*Instance, 0, len(m.instances))
	for _, inst := range m.instances {
		result = append(result, inst)
	}
	return result
}

// GetNames returns all instance names.
func (m *Manager) GetNames() []string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	names := make([]string, 0, len(m.instances))
	for name := range m.instances {
		names = append(names, name)
	}
	return names
}

// CheckHealth checks if an instance is reachable.
func (m *Manager) CheckHealth(name string) (bool, error) {
	inst := m.Get(name)
	if inst == nil {
		return false, fmt.Errorf("instance %q not found", name)
	}

	req, err := http.NewRequest("GET", inst.URL+"/v1/system/info", nil)
	if err != nil {
		return false, err
	}
	if inst.AuthHeader != "" {
		req.Header.Set("Authorization", inst.AuthHeader)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	req = req.WithContext(ctx)

	resp, err := inst.client.Do(req)
	if err != nil {
		return false, err
	}
	defer resp.Body.Close()

	return resp.StatusCode >= 200 && resp.StatusCode < 300, nil
}

// GetSystemInfo fetches system info from a Telemt instance.
func (m *Manager) GetSystemInfo(name string) (*SystemInfo, error) {
	inst := m.Get(name)
	if inst == nil {
		return nil, fmt.Errorf("instance %q not found", name)
	}

	req, err := http.NewRequest("GET", inst.URL+"/v1/system/info", nil)
	if err != nil {
		return nil, err
	}
	if inst.AuthHeader != "" {
		req.Header.Set("Authorization", inst.AuthHeader)
	}

	resp, err := inst.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("telemt API returned status %d", resp.StatusCode)
	}

	var result struct {
		Data SystemInfo `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return &result.Data, nil
}

// ProxyRequest proxies an HTTP request to a Telemt instance.
func (m *Manager) ProxyRequest(name string, w http.ResponseWriter, r *http.Request) {
	inst := m.Get(name)
	if inst == nil {
		http.Error(w, `{"ok":false,"error":{"code":"not_found","message":"instance not found"}}`, http.StatusNotFound)
		return
	}

	target, err := url.Parse(inst.URL)
	if err != nil {
		http.Error(w, `{"ok":false,"error":{"code":"internal_error","message":"invalid instance URL"}}`, http.StatusInternalServerError)
		return
	}

	// Strip /api/instances/{name} prefix from path
	path := r.URL.Path
	prefix := "/api/instances/" + name
	if strings.HasPrefix(path, prefix) {
		path = strings.TrimPrefix(path, prefix)
	}
	if path == "" {
		path = "/"
	}

	// Create proxy request
	proxyReq, err := http.NewRequest(r.Method, target.String()+path, r.Body)
	if err != nil {
		http.Error(w, `{"ok":false,"error":{"code":"internal_error","message":"failed to create proxy request"}}`, http.StatusInternalServerError)
		return
	}

	// Copy headers
	for k, vv := range r.Header {
		for _, v := range vv {
			proxyReq.Header.Add(k, v)
		}
	}

	// Set auth header
	if inst.AuthHeader != "" {
		proxyReq.Header.Set("Authorization", inst.AuthHeader)
	}

	// Execute request
	resp, err := inst.client.Do(proxyReq)
	if err != nil {
		http.Error(w, `{"ok":false,"error":{"code":"bad_gateway","message":"telemt API unavailable"}}`, http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	// Copy response headers
	for k, vv := range resp.Header {
		for _, v := range vv {
			w.Header().Add(k, v)
		}
	}
	w.WriteHeader(resp.StatusCode)

	_, _ = io.Copy(w, resp.Body)
}

// GetClient returns the HTTP client for an instance.
func (m *Manager) GetClient(name string) (*http.Client, error) {
	inst := m.Get(name)
	if inst == nil {
		return nil, fmt.Errorf("instance %q not found", name)
	}
	return inst.client, nil
}

// GetBaseURL returns the base URL for an instance.
func (m *Manager) GetBaseURL(name string) (string, error) {
	inst := m.Get(name)
	if inst == nil {
		return "", fmt.Errorf("instance %q not found", name)
	}
	return inst.URL, nil
}

// GetAuthHeader returns the auth header for an instance.
func (m *Manager) GetAuthHeader(name string) (string, error) {
	inst := m.Get(name)
	if inst == nil {
		return "", fmt.Errorf("instance %q not found", name)
	}
	return inst.AuthHeader, nil
}
