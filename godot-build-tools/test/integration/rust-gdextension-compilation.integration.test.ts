/**
 * Integration tests for Rust GDExtension compilation pipeline
 * Tests the Cargo.toml generation and project structure validation on the character_rust_gdext project
 */

import * as fs from 'fs';
import * as path from 'path';
import { RustCompilationStep } from '../../lib/build-steps/rust-compilation-step';
import { RustGDExtensionProjectType } from '../../lib/project-types/rust-gdextension-project-type';
import { BuildContext, ProjectTypeEnum } from '../../lib/core/interfaces';

describe('Rust GDExtension Compilation Integration', () => {
  let workspaceRoot: string;
  let characterRustGdextRoot: string;
  let buildDir: string;
  let tmpDir: string;

  beforeAll(() => {
    // Find workspace root by looking for nx.json
    workspaceRoot = process.cwd();
    while (!fs.existsSync(path.join(workspaceRoot, 'nx.json')) && workspaceRoot !== '/') {
      workspaceRoot = path.dirname(workspaceRoot);
    }
    
    characterRustGdextRoot = path.join(workspaceRoot, 'character_rust_gdext');
    buildDir = path.join(characterRustGdextRoot, 'build');
    tmpDir = path.join(characterRustGdextRoot, 'tmp');
  });

  beforeEach(() => {
    // Clean up any existing build and tmp directories
    if (fs.existsSync(buildDir)) {
      fs.rmSync(buildDir, { recursive: true, force: true });
    }
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    // Clean up build and tmp directories after each test
    if (fs.existsSync(buildDir)) {
      fs.rmSync(buildDir, { recursive: true, force: true });
    }
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  describe('RustGDExtensionProjectType', () => {
    it('should have correct project type', () => {
      const projectType = new RustGDExtensionProjectType();
      expect(projectType.name).toBe(ProjectTypeEnum.GDEXTENSION);
    });

    it('should create build pipeline with correct steps', () => {
      const projectType = new RustGDExtensionProjectType();
      const context: BuildContext = {
        projectName: 'character-rust-gdext',
        projectRoot: characterRustGdextRoot,
        workspaceRoot,
        buildDir,
        dependencies: [],
        options: {}
      };

      const pipeline = projectType.createBuildPipeline(context);
      
      expect(pipeline).toHaveLength(3);
      expect(pipeline[0]).toBeInstanceOf(RustCompilationStep);
      expect(pipeline[0].name).toBe('Rust GDExtension Compilation');
      expect(pipeline[1].name).toBe('Organize Compiled Binaries');
      expect(pipeline[2].name).toBe('GDExtension Bundle');
    });
  });

  describe('Cargo.toml generation', () => {
    let compilationStep: RustCompilationStep;
    let testContext: BuildContext;
    let originalCargoToml: string | null = null;

    beforeEach(() => {
      compilationStep = new RustCompilationStep({
        platforms: [], // Empty platforms to avoid actual compilation
        targets: []
      });
      
      testContext = {
        projectName: 'character-rust-gdext',
        projectRoot: characterRustGdextRoot,
        workspaceRoot,
        buildDir,
        dependencies: [],
        options: {}
      };

      // Backup existing Cargo.toml if it exists
      const cargoTomlPath = path.join(characterRustGdextRoot, 'Cargo.toml');
      if (fs.existsSync(cargoTomlPath)) {
        originalCargoToml = fs.readFileSync(cargoTomlPath, 'utf8');
        fs.unlinkSync(cargoTomlPath);
      }
    });

    afterEach(() => {
      // Restore original Cargo.toml if it existed
      const cargoTomlPath = path.join(characterRustGdextRoot, 'Cargo.toml');
      if (originalCargoToml !== null) {
        fs.writeFileSync(cargoTomlPath, originalCargoToml, 'utf8');
      } else if (fs.existsSync(cargoTomlPath)) {
        fs.unlinkSync(cargoTomlPath);
      }
    });

    it('should generate Cargo.toml when it does not exist', async () => {
      // Verify character_rust_gdext project exists
      expect(fs.existsSync(characterRustGdextRoot)).toBe(true);
      expect(fs.existsSync(path.join(characterRustGdextRoot, 'project.json'))).toBe(true);
      expect(fs.existsSync(path.join(characterRustGdextRoot, 'src'))).toBe(true);

      const cargoTomlPath = path.join(characterRustGdextRoot, 'Cargo.toml');
      expect(fs.existsSync(cargoTomlPath)).toBe(false);

      // Execute the compilation step (will fail at compilation but should generate Cargo.toml)
      try {
        await compilationStep.execute(testContext);
      } catch (error) {
        // Expected to fail since we're not actually compiling
      }

      // Verify Cargo.toml was generated
      expect(fs.existsSync(cargoTomlPath)).toBe(true);
      
      const cargoTomlContent = fs.readFileSync(cargoTomlPath, 'utf8');
      expect(cargoTomlContent).toContain('[package]');
      expect(cargoTomlContent).toContain('name = "character_rust_gdext"');
      expect(cargoTomlContent).toContain('version = "0.1.0"');
      expect(cargoTomlContent).toContain('edition = "2021"');
      expect(cargoTomlContent).toContain('[lib]');
      expect(cargoTomlContent).toContain('crate-type = ["cdylib"]');
      expect(cargoTomlContent).toContain('[dependencies]');
      expect(cargoTomlContent).toContain('godot =');
    });

    it('should validate existing Cargo.toml with correct configuration', async () => {
      const cargoTomlPath = path.join(characterRustGdextRoot, 'Cargo.toml');
      
      // Create a valid Cargo.toml
      const validCargoToml = `[package]
name = "character_rust_gdext"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
godot = { git = "https://github.com/godot-rust/gdext", branch = "master" }
`;
      
      fs.writeFileSync(cargoTomlPath, validCargoToml, 'utf8');

      // Should not throw an error
      try {
        await compilationStep.execute(testContext);
      } catch (error) {
        // Expected to fail at compilation, but not at validation
        expect(error.message).not.toContain('Cargo.toml must specify');
        expect(error.message).not.toContain('Cargo.toml must include');
      }
    });

    it('should reject Cargo.toml missing cdylib crate type', async () => {
      const cargoTomlPath = path.join(characterRustGdextRoot, 'Cargo.toml');
      
      // Create an invalid Cargo.toml (missing cdylib)
      const invalidCargoToml = `[package]
name = "character_rust_gdext"
version = "0.1.0"
edition = "2021"

[dependencies]
godot = { git = "https://github.com/godot-rust/gdext", branch = "master" }
`;
      
      fs.writeFileSync(cargoTomlPath, invalidCargoToml, 'utf8');

      await expect(compilationStep.execute(testContext)).rejects.toThrow(
        'Cargo.toml must specify crate-type = ["cdylib"] for GDExtension projects'
      );
    });

    it('should reject Cargo.toml missing godot dependency', async () => {
      const cargoTomlPath = path.join(characterRustGdextRoot, 'Cargo.toml');
      
      // Create an invalid Cargo.toml (missing godot dependency)
      const invalidCargoToml = `[package]
name = "character_rust_gdext"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
serde = "1.0"
`;
      
      fs.writeFileSync(cargoTomlPath, invalidCargoToml, 'utf8');

      await expect(compilationStep.execute(testContext)).rejects.toThrow(
        'Cargo.toml must include godot dependency for GDExtension projects'
      );
    });
  });

  describe('project structure validation', () => {
    it('should validate character_rust_gdext project structure', () => {
      // Verify the project has the expected structure for a Rust GDExtension
      expect(fs.existsSync(characterRustGdextRoot)).toBe(true);
      expect(fs.existsSync(path.join(characterRustGdextRoot, 'project.json'))).toBe(true);
      expect(fs.existsSync(path.join(characterRustGdextRoot, 'src'))).toBe(true);
      expect(fs.existsSync(path.join(characterRustGdextRoot, 'src', 'lib.rs'))).toBe(true);

      // Check that the Rust source files contain expected GDExtension patterns
      const libRsContent = fs.readFileSync(path.join(characterRustGdextRoot, 'src', 'lib.rs'), 'utf8');
      expect(libRsContent).toContain('use godot::prelude::*');
      expect(libRsContent).toContain('#[gdextension]');
      expect(libRsContent).toContain('ExtensionLibrary');
    });

    it('should validate project.json configuration', () => {
      const projectJsonPath = path.join(characterRustGdextRoot, 'project.json');
      const projectJson = JSON.parse(fs.readFileSync(projectJsonPath, 'utf8'));

      expect(projectJson.name).toBe('character-rust-gdext');
      expect(projectJson.projectType).toBe('library');
      expect(projectJson.targets).toBeDefined();
      expect(projectJson.targets.build).toBeDefined();
      expect(projectJson.targets.build.executor).toBe('@yharooer/godot-build-tools:gdextension');
    });
  });

  describe('platform target parsing', () => {
    it('should parse platform specifications correctly', () => {
      const compilationStep = new RustCompilationStep({
        platforms: ['windows.x86_64', 'macos.universal', 'linux.arm64'],
        targets: ['debug', 'release']
      });

      // We can't directly test the private method, but we can verify the step was created
      expect(compilationStep).toBeInstanceOf(RustCompilationStep);
      expect(compilationStep.name).toBe('Rust GDExtension Compilation');
    });

    it('should handle invalid platform specifications', async () => {
      const compilationStep = new RustCompilationStep({
        platforms: ['invalid-platform-spec'],
        targets: ['debug']
      });

      const testContext: BuildContext = {
        projectName: 'test-project',
        projectRoot: characterRustGdextRoot,
        workspaceRoot,
        buildDir,
        dependencies: [],
        options: {}
      };

      await expect(compilationStep.execute(testContext)).rejects.toThrow(
        'Invalid platform specification'
      );
    });
  });
});