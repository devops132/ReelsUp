
package main

import "testing"

func TestPasswordHashing(t *testing.T) {
    hash, err := HashPassword("secret123")
    if err != nil { t.Fatalf("hash error: %v", err) }
    if !CheckPassword(hash, "secret123") {
        t.Fatalf("password should match")
    }
    if CheckPassword(hash, "wrong") {
        t.Fatalf("password should not match")
    }
}
