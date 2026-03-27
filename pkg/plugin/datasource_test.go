package plugin

import (
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// newTestDatasource returns a Datasource with a small bounded cache for unit testing.
func newTestDatasource(maxEntries int) *Datasource {
	return &Datasource{
		SecureJSONData: map[string]string{},
		cache: &AutocompleteCache{
			entries:    make(map[string]*CacheEntry),
			order:      make([]string, 0, maxEntries),
			maxEntries: maxEntries,
		},
	}
}

// -------------------------------------------------------------------------
// SetCachedEntry / GetCachedEntry — basic get/set
// -------------------------------------------------------------------------

func TestCache_SetAndGet(t *testing.T) {
	d := newTestDatasource(10)
	d.SetCachedEntry("k1", []string{"a", "b"})

	entry := d.GetCachedEntry("k1", time.Minute)
	require.NotNil(t, entry)
	assert.Equal(t, []string{"a", "b"}, entry.Data)
}

func TestCache_MissReturnsNil(t *testing.T) {
	d := newTestDatasource(10)
	assert.Nil(t, d.GetCachedEntry("nonexistent", time.Minute))
}

func TestCache_ExpiredEntryReturnsNil(t *testing.T) {
	d := newTestDatasource(10)
	d.SetCachedEntry("k1", []string{"x"})

	// Use a very short TTL so the entry is already expired.
	entry := d.GetCachedEntry("k1", -1*time.Second)
	assert.Nil(t, entry, "expired entry should return nil")
}

// -------------------------------------------------------------------------
// LRU eviction
// -------------------------------------------------------------------------

func TestCache_EvictsOldestWhenFull(t *testing.T) {
	const max = 3
	d := newTestDatasource(max)

	// Fill the cache to capacity.
	d.SetCachedEntry("k1", []string{"1"})
	d.SetCachedEntry("k2", []string{"2"})
	d.SetCachedEntry("k3", []string{"3"})

	// Add a 4th entry — k1 (oldest) must be evicted.
	d.SetCachedEntry("k4", []string{"4"})

	assert.Nil(t, d.GetCachedEntry("k1", time.Minute), "k1 should have been evicted")

	// k2, k3, k4 must still be present.
	require.NotNil(t, d.GetCachedEntry("k2", time.Minute))
	require.NotNil(t, d.GetCachedEntry("k3", time.Minute))
	require.NotNil(t, d.GetCachedEntry("k4", time.Minute))

	// Internal size must not exceed maxEntries.
	d.cache.mu.Lock()
	defer d.cache.mu.Unlock()
	assert.LessOrEqual(t, len(d.cache.entries), max)
	assert.LessOrEqual(t, len(d.cache.order), max)
}

func TestCache_EvictsChainUntilCapacity(t *testing.T) {
	const max = 2
	d := newTestDatasource(max)

	for i := 0; i < 10; i++ {
		d.SetCachedEntry(fmt.Sprintf("k%d", i), []string{fmt.Sprintf("v%d", i)})
	}

	d.cache.mu.Lock()
	defer d.cache.mu.Unlock()
	assert.Equal(t, max, len(d.cache.entries), "cache should never exceed maxEntries")
	assert.Equal(t, max, len(d.cache.order))
}

func TestCache_UpdateExistingKeyDoesNotGrow(t *testing.T) {
	const max = 3
	d := newTestDatasource(max)

	d.SetCachedEntry("k1", []string{"v1"})
	d.SetCachedEntry("k2", []string{"v2"})
	d.SetCachedEntry("k3", []string{"v3"})

	// Update an existing key — size must stay at max.
	d.SetCachedEntry("k1", []string{"updated"})

	d.cache.mu.Lock()
	defer d.cache.mu.Unlock()
	assert.Equal(t, max, len(d.cache.entries), "update should not grow the cache")
	assert.Equal(t, max, len(d.cache.order), "order slice should not grow on update")

	// The value should be updated.
	entry := d.cache.entries["k1"]
	require.NotNil(t, entry)
	assert.Equal(t, []string{"updated"}, entry.Data)
}

func TestCache_UpdatedKeyMovesToTailOfOrder(t *testing.T) {
	const max = 3
	d := newTestDatasource(max)

	d.SetCachedEntry("k1", []string{"1"})
	d.SetCachedEntry("k2", []string{"2"})
	d.SetCachedEntry("k3", []string{"3"})

	// Re-insert k1 — it should move to the tail so k2 becomes the new oldest.
	d.SetCachedEntry("k1", []string{"1-updated"})

	// Now add k4 — k2 (now the oldest) should be evicted, not k1.
	d.SetCachedEntry("k4", []string{"4"})

	assert.Nil(t, d.GetCachedEntry("k2", time.Minute), "k2 should be evicted (oldest after k1 was refreshed)")
	require.NotNil(t, d.GetCachedEntry("k1", time.Minute), "k1 should survive (was refreshed)")
	require.NotNil(t, d.GetCachedEntry("k3", time.Minute))
	require.NotNil(t, d.GetCachedEntry("k4", time.Minute))
}

// -------------------------------------------------------------------------
// CleanExpiredCache
// -------------------------------------------------------------------------

func TestCleanExpiredCache_RemovesExpiredEntries(t *testing.T) {
	d := newTestDatasource(100)
	d.SetCachedEntry("live", []string{"live"})
	d.SetCachedEntry("stale", []string{"stale"})

	// Back-date the "stale" entry so it appears expired.
	d.cache.mu.Lock()
	d.cache.entries["stale"].Timestamp = time.Now().Add(-2 * time.Hour)
	d.cache.mu.Unlock()

	d.CleanExpiredCache(time.Hour)

	assert.NotNil(t, d.GetCachedEntry("live", time.Hour))
	assert.Nil(t, d.GetCachedEntry("stale", time.Hour), "stale entry should be cleaned")

	d.cache.mu.Lock()
	defer d.cache.mu.Unlock()
	assert.Equal(t, 1, len(d.cache.entries))
	assert.Equal(t, 1, len(d.cache.order))
}

func TestCleanExpiredCache_CompactsOrderSlice(t *testing.T) {
	d := newTestDatasource(100)

	for i := 0; i < 5; i++ {
		d.SetCachedEntry(fmt.Sprintf("k%d", i), []string{"v"})
	}

	// Expire all odd-indexed keys.
	d.cache.mu.Lock()
	for i := 1; i < 5; i += 2 {
		d.cache.entries[fmt.Sprintf("k%d", i)].Timestamp = time.Now().Add(-2 * time.Hour)
	}
	d.cache.mu.Unlock()

	d.CleanExpiredCache(time.Hour)

	d.cache.mu.Lock()
	defer d.cache.mu.Unlock()
	assert.Equal(t, len(d.cache.entries), len(d.cache.order),
		"order slice length must match entries map length after cleanup")
}

// -------------------------------------------------------------------------
// Concurrency safety
// -------------------------------------------------------------------------

func TestCache_ConcurrentWritesDoNotRace(t *testing.T) {
	d := newTestDatasource(50)

	var wg sync.WaitGroup
	for i := 0; i < 200; i++ {
		wg.Add(1)
		go func(n int) {
			defer wg.Done()
			key := fmt.Sprintf("k%d", n%20) // deliberately collide keys
			d.SetCachedEntry(key, []string{fmt.Sprintf("v%d", n)})
			d.GetCachedEntry(key, time.Minute)
		}(i)
	}
	wg.Wait()

	// Cache size must remain within bounds.
	d.cache.mu.Lock()
	defer d.cache.mu.Unlock()
	assert.LessOrEqual(t, len(d.cache.entries), 50)
}
