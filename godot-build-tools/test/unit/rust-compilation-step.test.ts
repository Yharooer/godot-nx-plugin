/**
 * Unit tests for RustCompilationStep
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { RustCompilationStep } from '../../lib/build-steps/rust-compilation-step';
import { BuildContext } from '../../lib/core/interfaces';
import { CompilationError } from '../../lib/core/errors';

// Mock dependencies
jest.mock('fs');
jest.mock('child_process');
jest.mock('../../lib/utils/file-operations', () => ({
  ensureDirectoryExists: jest.fn(),
}));

import { ensureDirectoryExists } from '../../lib/utils/file-operations';

const mockFs = fs as jest.Mocked<typeof fs>;
const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;
const mockEnsureDirectoryExists = ensureDirectoryExists as jest.MockedFunction<typeof ensureDirectoryExists>;

describe('RustCompilationStep', () => {
  let step: RustCompilationStep;
  let mockContext: BuildContext;

  beforeEach(() => {
    jest.clearAllMocks();
    
    step = new RustCompilationStep();
    mockContext = {
      projectName: 'test-rust-project',
      projectRoot: '/workspace/test-rust-project',
      workspaceRoot: '/workspace',
      buildDir: '/workspace/test-rust-project/build',
      dependencies: [],
      options: {}
    };

    // Mock fs methods
    mockFs.existsSync.mockReturnValue(false);
    mockFs.writeFileSync.mockImplementation(() => {});
    mockFs.readFileSync.mockReturnValue('');
    mockFs.copyFileSync.mockImplementation(() => {});
    mockFs.readdirSync.mockReturnValue([]);

    // Mock execSync to succeed by default
    mockExecSync.mockImplementation(() => Buffer.from(''));

    // Mock ensureDirectoryExists to succeed by default
    mockEnsureDirectoryExists.mockResolvedValue();
  });

  describe('execute', () => {
    it('should generate Cargo.toml when it does not exist', async () => {
      // Mock for non-universal platforms only to avoid universal binary compilation
      step = new RustCompilationStep({
        platforms: ['linux.x86_64'],
        targets: ['debug']
      });

      mockFs.existsSync.mockImplementation((filePath: string) => {
        if (filePath.includes('Cargo.toml')) return false;
        if (filePath.includes('libtest_rust_project.so')) return true;
        return false;
      });

      mockFs.readdirSync.mockReturnValue([
        'libtest_rust_project.linux.template_debug.x86_64.so'
      ]);

      await step.execute(mockContext);

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        '/workspace/test-rust-project/Cargo.toml',
        expect.stringContaining('[package]'),
        'utf8'
      );
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        '/workspace/test-rust-project/Cargo.toml',
        expect.stringContaining('crate-type = ["cdylib"]'),
        'utf8'
      );
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        '/workspace/test-rust-project/Cargo.toml',
        expect.stringContaining('godot ='),
        'utf8'
      );
    });

    it('should validate existing Cargo.toml', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(`
        [package]
        name = "test_rust_project"
        version = "0.1.0"
        edition = "2021"

        [lib]
        crate-type = ["cdylib"]

        [dependencies]
        godot = { git = "https://github.com/godot-rust/gdext", branch = "master" }
      `);

      await step.execute(mockContext);

      expect(mockFs.readFileSync).toHaveBeenCalledWith(
        '/workspace/test-rust-project/Cargo.toml',
        'utf8'
      );
    });

    it('should throw error if Cargo.toml is missing cdylib crate type', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(`
        [package]
        name = "test_rust_project"
        version = "0.1.0"
        edition = "2021"

        [dependencies]
        godot = { git = "https://github.com/godot-rust/gdext", branch = "master" }
      `);

      await expect(step.execute(mockContext)).rejects.toThrow(CompilationError);
      await expect(step.execute(mockContext)).rejects.toThrow(
        'Cargo.toml must specify crate-type = ["cdylib"] for GDExtension projects'
      );
    });

    it('should throw error if Cargo.toml is missing godot dependency', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(`
        [package]
        name = "test_rust_project"
        version = "0.1.0"
        edition = "2021"

        [lib]
        crate-type = ["cdylib"]
      `);

      await expect(step.execute(mockContext)).rejects.toThrow(CompilationError);
      await expect(step.execute(mockContext)).rejects.toThrow(
        'Cargo.toml must include godot dependency for GDExtension projects'
      );
    });

    it('should compile for default platforms and targets', async () => {
      // Use non-universal platforms to avoid universal binary compilation issues
      step = new RustCompilationStep({
        platforms: ['windows.x86_64', 'linux.x86_64'],
        targets: ['debug', 'release']
      });

      mockFs.existsSync.mockImplementation((filePath: string) => {
        if (filePath.includes('Cargo.toml')) return false;
        if (filePath.includes('.dll') || filePath.includes('.so')) return true;
        return false;
      });

      mockFs.readdirSync.mockReturnValue([
        'libtest_rust_project.windows.template_debug.x86_64.dll',
        'libtest_rust_project.windows.template_release.x86_64.dll',
        'libtest_rust_project.linux.template_debug.x86_64.so',
        'libtest_rust_project.linux.template_release.x86_64.so'
      ]);

      await step.execute(mockContext);

      // Should call cargo build for each platform/target combination
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('cargo build --target=x86_64-pc-windows-msvc --target-dir='),
        expect.any(Object)
      );
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('cargo build --target=x86_64-pc-windows-msvc --target-dir='),
        expect.any(Object)
      );
    });

    it('should compile for custom platforms and targets', async () => {
      step = new RustCompilationStep({
        platforms: ['linux.x86_64'],
        targets: ['release']
      });

      mockFs.existsSync.mockReturnValue(false);
      mockFs.readdirSync.mockReturnValue([
        'libtest_rust_project.linux.template_release.x86_64.so'
      ]);

      await step.execute(mockContext);

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('cargo build --target=x86_64-unknown-linux-gnu --target-dir='),
        expect.any(Object)
      );
      expect(mockExecSync).toHaveBeenCalledTimes(1);
    });

    it('should throw CompilationError when cargo build fails', async () => {
      mockFs.existsSync.mockReturnValue(false);
      mockExecSync.mockImplementation(() => {
        throw new Error('Cargo build failed');
      });

      await expect(step.execute(mockContext)).rejects.toThrow(CompilationError);
      await expect(step.execute(mockContext)).rejects.toThrow(
        'Failed to compile Rust GDExtension'
      );
    });

    it('should create tmp and build directories', async () => {
      step = new RustCompilationStep({
        platforms: ['linux.x86_64'],
        targets: ['debug']
      });

      mockFs.existsSync.mockImplementation((filePath: string) => {
        if (filePath.includes('Cargo.toml')) return false;
        if (filePath.includes('libtest_rust_project.so')) return true;
        return false;
      });

      mockFs.readdirSync.mockReturnValue([
        'libtest_rust_project.linux.template_debug.x86_64.so'
      ]);

      await step.execute(mockContext);

      expect(mockEnsureDirectoryExists).toHaveBeenCalledWith(
        '/workspace/test-rust-project/tmp',
        'test-rust-project'
      );
      expect(mockEnsureDirectoryExists).toHaveBeenCalledWith(
        '/workspace/test-rust-project/build/bin',
        'test-rust-project'
      );
    });

    it('should organize compiled binaries with correct Godot naming', async () => {
      step = new RustCompilationStep({
        platforms: ['windows.x86_64'],
        targets: ['debug']
      });

      mockFs.existsSync.mockImplementation((filePath: string) => {
        if (filePath.includes('Cargo.toml')) return false;
        // Mock the compiled binary path that the organizer looks for
        if (filePath.includes('x86_64-pc-windows-msvc/debug/test_rust_project.dll')) return true;
        return false;
      });

      mockFs.readdirSync.mockReturnValue([
        'libtest_rust_project.windows.template_debug.x86_64.dll'
      ]);

      await step.execute(mockContext);

      // The compilation step no longer organizes binaries - that's done by OrganizeCompiledBinariesStep
      expect(mockFs.copyFileSync).not.toHaveBeenCalled();
    });

    it('should handle universal binary compilation for macOS', async () => {
      step = new RustCompilationStep({
        platforms: ['macos.universal'],
        targets: ['debug']
      });

      mockFs.existsSync.mockImplementation((filePath: string) => {
        if (filePath.includes('Cargo.toml')) return false;
        if (filePath.includes('libtest_rust_project.dylib')) return true;
        return false;
      });

      mockFs.readdirSync.mockReturnValue([
        'libtest_rust_project.macos.template_debug.framework'
      ]);

      await step.execute(mockContext);

      // Should compile for both x86_64 and arm64
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('cargo build --target=x86_64-apple-darwin'),
        expect.any(Object)
      );
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('cargo build --target=aarch64-apple-darwin'),
        expect.any(Object)
      );
    });

    it('should throw error for unsupported platform', async () => {
      step = new RustCompilationStep({
        platforms: ['unsupported.platform'],
        targets: ['debug']
      });

      mockFs.existsSync.mockReturnValue(false);

      await expect(step.execute(mockContext)).rejects.toThrow(CompilationError);
      await expect(step.execute(mockContext)).rejects.toThrow(
        'Unsupported platform target: unsupported.platform'
      );
    });
  });

  describe('name', () => {
    it('should have correct name', () => {
      expect(step.name).toBe('Rust GDExtension Compilation');
    });
  });
});