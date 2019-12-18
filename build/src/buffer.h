#ifndef BUFFER_H
#define BUFFER_H

// This limits the number of simultaneous
// open databases possible.
#define BUFFER_REG_SIZE 64

// Growing buffer
typedef struct buffer {
  char* bytes;
  int   size;
} buffer;

// Create and delete buffers
buffer* new_buffer();
void    destroy_buffer(buffer* b);

// Read from and write to buffers
int grow_buffer(buffer* b, int size);
int read_buffer(buffer* b, char* out, int offset, int length);
int write_buffer(buffer* b, char* src, int offset, int length);

// Access buffer registry
buffer* get_reg_buffer(int id);
int     valid_reg_buffer_id(int id);
int     in_use_reg_buffer_id(int id);
void    delete_reg_buffer(int id);

#endif // BUFFER_H
