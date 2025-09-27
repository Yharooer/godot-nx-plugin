use godot::prelude::*;

mod rust_example_node2d;

struct CharacterRustGdext;

#[gdextension]
unsafe impl ExtensionLibrary for CharacterRustGdext {}
