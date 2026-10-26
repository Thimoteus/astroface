#include <pebble.h>

int main(void) {
  Window *w = window_create();
  window_stack_push(w, true);

  /* Engine pool sizes. NULL would mean a fixed 32 kB pool shared by the slot
   * heap, chunk heap, and stack. These are the exact sizes from the official
   * Alloy docs example (~55 kB total), known to fit alongside the native
   * side within the ~122 kB app RAM budget. When the total exceeds 32 kB the
   * engine uses exactly these sizes and never grows.
   *
   * kModdableCreationFlagLogInstrumentation makes the engine stream real
   * slot/chunk/stack stats into the app log while a log listener is attached
   * -- remove it once the memory situation is settled. */
  moddable_createMachine(&(ModdableCreationRecord){
      .recordSize = sizeof(ModdableCreationRecord),
      .flags = kModdableCreationFlagLogInstrumentation,
      .stack = 5120,
      .slot = 31744,
      .chunk = 19456,
  });

  window_destroy(w);
}
