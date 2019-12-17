#include <stdlib.h>
#include <string.h>
#include <stdbool.h>
#include "buffer.h"

buffer** registry = NULL;

// Create a new buffer or return NULL.
buffer* new_buffer() {
  buffer* b = malloc(sizeof(buffer));
  if (b == NULL)
    return NULL;
  b->bytes = NULL;
  b->size = 0;
  return b;
}

// Deallocate a buffer. Passing NULL is
// a safe no-op.
void destroy_buffer(buffer* b) {
  if (b == NULL)
    return;
  if (b->bytes != NULL)
    free(b->bytes);
  free(b);
}

// Ensure buffer has at least size bytes of capacity.
// Return true or false, depending on success.
int grow_buffer(buffer* b, int size) {
  if (b->size >= size)
    return true;
  char* new_bytes;
  if (b->bytes != NULL) {
    new_bytes = realloc(b->bytes, sizeof(char) * size);
  } else {
    new_bytes = malloc(sizeof(char) * size);
  }
  if (new_bytes == NULL)
    return false;
  b->bytes = new_bytes;
  b->size = size;
  return true;
}

// Read length bytes from buffer, starting at offset. Return
// bytes read. This will read partially, if size is exceeded.
int read_buffer(buffer* b, char* out, int offset, int length) {
  if (offset + length > b->size)
    length = b->size - offset;
  if (length <= 0)
    return 0;
  memcpy(out, &(b->bytes[offset]), length);
  return length;
}

// Write length bytes from src to buffer, starting at offset.
// Return bytes written.
int write_buffer(buffer* b, char* src, int offset, int length) {
  if (!grow_buffer(b, offset+length))
    return 0;
  memcpy(&(b->bytes[offset]), src, length);
  return length;
}

// Ensure if is within bounds
#define VALID_REG_ID(id) (id >= 0 && id < BUFFER_REG_SIZE)

// Return buffer at id, or NULL on failure.
buffer* get_reg_buffer(int id) {
  if (!VALID_REG_ID(id))
    return NULL;
  // Ensure registry exists
  if (registry == NULL) {
    registry = malloc(sizeof(buffer*) * BUFFER_REG_SIZE);
    if (registry == NULL)
      return NULL;
    for (int i = 0; i < BUFFER_REG_SIZE; i ++)
      registry[i] = NULL;
  }
  // Ensure buffer at id exists
  if (registry[id] == NULL)
    registry[id] = new_buffer();
  return registry[id];
}

// Determines is a buffer id is valid
int valid_reg_id(int id) {
  return VALID_REG_ID(id);
}

// Returns a boolean indicating if the id is in use.
int in_use_reg_id(int id) {
  if (!VALID_REG_ID(id))
    return false;
  if (registry == NULL)
    return false;
  return registry[id] != NULL;
}

// Delete the buffer at id.
void delete_reg_buffer(int id) {
  if (!VALID_REG_ID(id))
    return;
  if (registry == NULL)
    return;
  destroy_buffer(registry[id]);
  registry[id] = NULL;
}
