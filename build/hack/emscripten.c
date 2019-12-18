#ifndef WASI_BUILD

// Provide main for emscripten build, which we use to make
// debug builds, as we can use printf there.
int main() {
  // NO OP
}

#endif
