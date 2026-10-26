#include <pebble.h>

int main(void) {
  Window *w = window_create();
  window_stack_push(w, true);

  /* NULL here means a fixed 32 kB engine pool shared by the slot heap, chunk
   * heap, and stack -- far too small for this face (alst_core tables + the
   * star buffer + per-message strings). App RAM is ~122 kB total and native
   * code uses roughly 28 kB, so give the engine ~66 kB. All three sizes must
   * be set, and when their total exceeds 32 kB the engine uses exactly these
   * sizes and never grows. If the face OOMs at *launch*, back slot/chunk down
   * ~25% at a time. */
  moddable_createMachine(&(ModdableCreationRecord){
      .recordSize = sizeof(ModdableCreationRecord),
      .stack = 6144,
      .slot = 36864,
      .chunk = 24576,
  });

  window_destroy(w);
}
