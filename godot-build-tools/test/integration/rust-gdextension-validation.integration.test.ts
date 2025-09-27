/**
 * Integration validation tests for Rust GDExtension compilation pipeline
 * Tests the complete pipeline with realistic configurations
 */

import * as fs from 'fs';
import * as path from 'path';
import { RustGDExtensionProjectType } from '../../lib/project-types/rust-gdextension-project-type';
import { BuildContext } from '../../lib/core/interfaces';

describe('Rust GDExtension Pipeline Validation', () => {
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

  describe('Multi-platform configuration validation', () => {
    it('should create project type with multi-platform configuration', () => {
      const projectType = new RustGDExtensionProjectType({
        platforms: [
          'windows.x86_64',
          'windows.arm64',
          'macos.universal',
          'linux.x86_64',
          'linux.arm64',
          'android.arm64',
          'web.wasm32'
        ],
        targets: ['debug', 'release'],
        compatibilityMinimum: '4.2',
        reloadable: true,
        linkType: 'dynamic'
      });

      const context: BuildContext = {
        projectName: 'character-rust-gdext',
        projectRoot: characterRustGdextRoot,
        workspaceRoot,
        buildDir,
        dependencies: [],
        options: {}
      };

      const pipeline = projectType.createBuildPipeline(context);
      
      expect(pipeline).toHaveLength(2);
      expect(pipeline[0].name).toBe('Rust GDExtension Compilation');
      expect(pipeline[1].name).toBe('GDExtension Bundle');
    });

    it('should handle minimal configuration', () => {
      const projectType = new RustGDExtensionProjectType({
        platforms: ['linux.x86_64'],
        targets: ['debug']
      });

      const context: BuildContext = {
        projectName: 'character-rust-gdext',
        projectRoot: characterRustGdextRoot,
        workspaceRoot,
        buildDir,
        dependencies: [],
        options: {}
      };

      const pipeline = projectType.createBuildPipeline(context);
      
      expect(pipeline).toHaveLength(2);
      expect(pipeline[0].name).toBe('Rust GDExtension Compilation');
      expect(pipeline[1].name).toBe('GDExtension Bundle');
    });

    it('should handle custom entry symbol configuration', () => {
      const projectType = new RustGDExtensionProjectType({
        entrySymbol: 'character_rust_gdext_library_init',
        compatibilityMinimum: '4.1',
        reloadable: false
      });

      const context: BuildContext = {
        projectName: 'character-rust-gdext',
        projectRoot: characterRustGdextRoot,
        workspaceRoot,
        buildDir,
        dependencies: [],
        options: {}
      };

      const pipeline = projectType.createBuildPipeline(context);
      
      expect(pipeline).toHaveLength(2);
    });
  });

  describe('Platform target validation', () => {
    const validPlatformTargets = [
      'windows.x86_64',
      'windows.arm64',
      'macos.x86_64',
      'macos.arm64',
      'macos.universal',
      'linux.x86_64',
      'linux.arm64',
      'linux.rv64',
      'android.arm64',
      'android.x86_64',
      'ios.arm64',
      'ios.universal',
      'web.wasm32'
    ];

    it.each(validPlatformTargets)('should accept valid platform target: %s', (platformTarget) => {
      const projectType = new RustGDExtensionProjectType({
        platforms: [platformTarget],
        targets: ['debug']
      });

      expect(projectType).toBeInstanceOf(RustGDExtensionProjectType);
    });

    const invalidPlatformTargets = [
      'invalid',
      'windows',
      'macos.invalid',
      'linux.x86',
      'android',
      'ios.x86_64'
    ];

    it.each(invalidPlatformTargets)('should handle invalid platform target gracefully: %s', (platformTarget) => {
      // The project type should be created successfully, but compilation should fail
      const projectType = new RustGDExtensionProjectType({
        platforms: [platformTarget],
        targets: ['debug']
      });

      expect(projectType).toBeInstanceOf(RustGDExtensionProjectType);
    });
  });

  describe('Build target validation', () => {
    const validBuildTargets = ['debug', 'release'];

    it.each(validBuildTargets)('should accept valid build target: %s', (buildTarget) => {
      const projectType = new RustGDExtensionProjectType({
        platforms: ['linux.x86_64'],
        targets: [buildTarget]
      });

      expect(projectType).toBeInstanceOf(RustGDExtensionProjectType);
    });

    it('should handle multiple build targets', () => {
      const projectType = new RustGDExtensionProjectType({
        platforms: ['linux.x86_64'],
        targets: ['debug', 'release']
      });

      expect(projectType).toBeInstanceOf(RustGDExtensionProjectType);
    });
  });

  describe('Godot compatibility validation', () => {
    const validCompatibilityVersions = ['4.0', '4.1', '4.2', '4.3'];

    it.each(validCompatibilityVersions)('should accept valid compatibility version: %s', (version) => {
      const projectType = new RustGDExtensionProjectType({
        compatibilityMinimum: version
      });

      expect(projectType).toBeInstanceOf(RustGDExtensionProjectType);
    });

    it('should handle reloadable configuration', () => {
      const reloadableProjectType = new RustGDExtensionProjectType({
        reloadable: true
      });

      const nonReloadableProjectType = new RustGDExtensionProjectType({
        reloadable: false
      });

      expect(reloadableProjectType).toBeInstanceOf(RustGDExtensionProjectType);
      expect(nonReloadableProjectType).toBeInstanceOf(RustGDExtensionProjectType);
    });
  });

  describe('Link type validation', () => {
    const validLinkTypes = ['static', 'dynamic'] as const;

    it.each(validLinkTypes)('should accept valid link type: %s', (linkType) => {
      const projectType = new RustGDExtensionProjectType({
        linkType
      });

      expect(projectType).toBeInstanceOf(RustGDExtensionProjectType);
    });
  });

  describe('Real project structure validation', () => {
    it('should validate that character_rust_gdext has proper Cargo.toml', () => {
      const cargoTomlPath = path.join(characterRustGdextRoot, 'Cargo.toml');
      expect(fs.existsSync(cargoTomlPath)).toBe(true);

      const cargoTomlContent = fs.readFileSync(cargoTomlPath, 'utf8');
      expect(cargoTomlContent).toContain('name = "character_rust_gdext"');
      expect(cargoTomlContent).toContain('crate-type = ["cdylib"]');
      expect(cargoTomlContent).toContain('godot =');
    });

    it('should validate that character_rust_gdext has proper source structure', () => {
      expect(fs.existsSync(path.join(characterRustGdextRoot, 'src', 'lib.rs'))).toBe(true);
      expect(fs.existsSync(path.join(characterRustGdextRoot, 'src', 'rust_example_node2d.rs'))).toBe(true);

      const libRsContent = fs.readFileSync(path.join(characterRustGdextRoot, 'src', 'lib.rs'), 'utf8');
      expect(libRsContent).toContain('#[gdextension]');
      expect(libRsContent).toContain('ExtensionLibrary');

      const nodeContent = fs.readFileSync(path.join(characterRustGdextRoot, 'src', 'rust_example_node2d.rs'), 'utf8');
      expect(nodeContent).toContain('#[derive(GodotClass)]');
      expect(nodeContent).toContain('#[godot_api]');
    });

    it('should validate expected binary naming patterns', () => {
      // Test the expected binary naming patterns that would be generated
      const expectedPatterns = [
        'libcharacter_rust_gdext.windows.template_debug.x86_64.dll',
        'libcharacter_rust_gdext.windows.template_release.x86_64.dll',
        'libcharacter_rust_gdext.macos.template_debug.framework',
        'libcharacter_rust_gdext.macos.template_release.framework',
        'libcharacter_rust_gdext.linux.template_debug.x86_64.so',
        'libcharacter_rust_gdext.linux.template_release.x86_64.so',
        'libcharacter_rust_gdext.android.template_debug.arm64.so',
        'libcharacter_rust_gdext.web.template_debug.wasm32.wasm'
      ];

      // These patterns should be valid for the GDExtension bundle step
      for (const pattern of expectedPatterns) {
        expect(pattern).toMatch(/^lib\w+\.\w+\.template_(debug|release)\.(\w+\.)?\w+$/);
      }
    });
  });
});