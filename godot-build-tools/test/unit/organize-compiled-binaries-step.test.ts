/**
 * Unit tests for OrganizeCompiledBinariesStep
 */

import * as fs from 'fs';
import * as path from 'path';
import { OrganizeCompiledBinariesStep, PlatformTarget, CompiledBinarySource } from '../../lib/build-steps/organize-compiled-binaries-step';
import { BuildContext } from '../../lib/core/interfaces';

// Mock fs module
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

// Mock file operations
jest.mock('../../lib/utils/file-operations', () => ({
  ensureDirectoryExists: jest.fn(),
  getDirectoryEntries: jest.fn()
}));

import { ensureDirectoryExists, getDirectoryEntries } from '../../lib/utils/file-operations';
const mockEnsureDirectoryExists = ensureDirectoryExists as jest.MockedFunction<typeof ensureDirectoryExists>;
const mockGetDirectoryEntries = getDirectoryEntries as jest.MockedFunction<typeof getDirectoryEntries>;

describe('OrganizeCompiledBinariesStep', () => {
  let mockContext: BuildContext;
  let step: OrganizeCompiledBinariesStep;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockContext = {
      projectName: 'test-project',
      projectRoot: '/workspace/test-project',
      workspaceRoot: '/workspace',
      buildDir: '/workspace/test-project/build',
      dependencies: [],
      options: {}
    };

    // Setup default mocks
    mockFs.existsSync.mockReturnValue(true);
    mockFs.statSync.mockReturnValue({ isFile: () => true } as any);
    mockFs.copyFileSync.mockImplementation(() => {});
    mockFs.unlinkSync.mockImplementation(() => {});
    mockGetDirectoryEntries.mockReturnValue([]);
  });

  describe('Rust project organization', () => {
    beforeEach(() => {
      const platformTargets: PlatformTarget[] = [
        { platform: 'windows', architecture: 'x86_64', target: 'debug' },
        { platform: 'windows', architecture: 'x86_64', target: 'release' },
        { platform: 'macos', architecture: 'universal', target: 'debug' },
        { platform: 'linux', architecture: 'x86_64', target: 'release' }
      ];

      step = new OrganizeCompiledBinariesStep({
        projectType: 'rust',
        platformTargets
      });
    });

    it('should organize Rust binaries with correct Godot naming', async () => {
      // Mock binary files exist
      mockFs.existsSync.mockImplementation((filePath: any) => {
        const pathStr = filePath.toString();
        return pathStr.includes('test_project.dll') || 
               pathStr.includes('libtest_project.dylib') || 
               pathStr.includes('libtest_project.so') ||
               pathStr.includes('/bin') ||
               pathStr.includes('/build');
      });

      await step.execute(mockContext);

      // Verify directories were created
      expect(mockEnsureDirectoryExists).toHaveBeenCalledWith('/workspace/test-project/build', 'test-project');
      expect(mockEnsureDirectoryExists).toHaveBeenCalledWith('/workspace/test-project/build/bin', 'test-project');

      // Verify binaries were copied with correct names
      expect(mockFs.copyFileSync).toHaveBeenCalledWith(
        expect.stringContaining('test_project.dll'),
        '/workspace/test-project/build/bin/libtest_project.windows.template_debug.x86_64.dll'
      );
      expect(mockFs.copyFileSync).toHaveBeenCalledWith(
        expect.stringContaining('test_project.dll'),
        '/workspace/test-project/build/bin/libtest_project.windows.template_release.x86_64.dll'
      );
      expect(mockFs.copyFileSync).toHaveBeenCalledWith(
        expect.stringContaining('libtest_project.dylib'),
        '/workspace/test-project/build/bin/libtest_project.macos.template_debug.framework'
      );
      expect(mockFs.copyFileSync).toHaveBeenCalledWith(
        expect.stringContaining('libtest_project.so'),
        '/workspace/test-project/build/bin/libtest_project.linux.template_release.x86_64.so'
      );

      // Verify organized binaries were stored in context
      expect((mockContext as any).organizedBinaries).toBeDefined();
      expect((mockContext as any).organizedBinaries).toHaveLength(4);
    });

    it('should clean existing binaries before organizing', async () => {
      // Mock existing files in bin directory
      mockGetDirectoryEntries.mockReturnValue(['old-binary.dll', 'another-old.so']);
      
      await step.execute(mockContext);

      // Verify old files were removed
      expect(mockFs.unlinkSync).toHaveBeenCalledWith('/workspace/test-project/build/bin/old-binary.dll');
      expect(mockFs.unlinkSync).toHaveBeenCalledWith('/workspace/test-project/build/bin/another-old.so');
    });

    it('should handle missing source binaries gracefully', async () => {
      // Mock some binaries missing - only some paths exist
      mockFs.existsSync.mockImplementation((filePath: any) => {
        const pathStr = filePath.toString();
        if (pathStr.includes('/bin') || pathStr.includes('/build')) {
          return true;
        }
        // Only some binaries exist (simulate partial compilation)
        return pathStr.includes('test_project.dll') || pathStr.includes('libtest_project.dylib');
      });

      // Should not throw an error even when some binaries are missing
      await expect(step.execute(mockContext)).resolves.not.toThrow();

      // Should have copied at least some binaries
      expect(mockFs.copyFileSync).toHaveBeenCalled();
      expect((mockContext as any).organizedBinaries).toBeDefined();
      expect((mockContext as any).organizedBinaries.length).toBeGreaterThan(0);
    });
  });

  describe('C++ project organization', () => {
    beforeEach(() => {
      const platformTargets: PlatformTarget[] = [
        { platform: 'windows', architecture: 'x86_64', target: 'debug' },
        { platform: 'macos', architecture: 'arm64', target: 'release' }
      ];

      step = new OrganizeCompiledBinariesStep({
        projectType: 'cpp',
        platformTargets
      });
    });

    it('should organize C++ binaries with correct naming', async () => {
      // Mock C++ binary files exist
      mockFs.existsSync.mockImplementation((filePath: any) => {
        const pathStr = filePath.toString();
        return pathStr.includes('test_project.dll') || 
               pathStr.includes('libtest_project.dylib') ||
               pathStr.includes('/bin') ||
               pathStr.includes('/build');
      });

      await step.execute(mockContext);

      // Verify C++ binaries were copied with correct names
      expect(mockFs.copyFileSync).toHaveBeenCalledWith(
        expect.stringContaining('test_project.dll'),
        '/workspace/test-project/build/bin/libtest_project.windows.template_debug.x86_64.dll'
      );
      expect(mockFs.copyFileSync).toHaveBeenCalledWith(
        expect.stringContaining('libtest_project.dylib'),
        '/workspace/test-project/build/bin/libtest_project.macos.template_release.arm64.dylib'
      );
    });
  });

  describe('Custom binary discovery', () => {
    it('should use custom binary discovery function when provided', async () => {
      const customDiscovery = jest.fn().mockResolvedValue([
        {
          sourcePath: '/custom/path/binary.dll',
          platformTarget: { platform: 'windows', architecture: 'x86_64', target: 'debug' },
          originalName: 'custom-binary.dll'
        } as CompiledBinarySource
      ]);

      step = new OrganizeCompiledBinariesStep({
        projectType: 'rust',
        platformTargets: [{ platform: 'windows', architecture: 'x86_64', target: 'debug' }],
        binaryDiscovery: customDiscovery
      });

      await step.execute(mockContext);

      expect(customDiscovery).toHaveBeenCalledWith(
        '/workspace/test-project/tmp',
        'test-project',
        { platform: 'windows', architecture: 'x86_64', target: 'debug' }
      );

      expect(mockFs.copyFileSync).toHaveBeenCalledWith(
        '/custom/path/binary.dll',
        '/workspace/test-project/build/bin/libtest_project.windows.template_debug.x86_64.dll'
      );
    });
  });

  describe('Error handling', () => {
    beforeEach(() => {
      step = new OrganizeCompiledBinariesStep({
        projectType: 'rust',
        platformTargets: [{ platform: 'windows', architecture: 'x86_64', target: 'debug' }]
      });
    });

    it('should throw error when no binaries are found', async () => {
      mockFs.existsSync.mockReturnValue(false);

      await expect(step.execute(mockContext)).rejects.toThrow(
        'No compiled binaries found to organize'
      );
    });

    it('should throw error for unsupported project type', async () => {
      step = new OrganizeCompiledBinariesStep({
        projectType: 'unsupported' as any,
        platformTargets: [{ platform: 'windows', architecture: 'x86_64', target: 'debug' }]
      });

      await expect(step.execute(mockContext)).rejects.toThrow(
        'Unsupported project type: unsupported'
      );
    });
  });

  describe('Godot naming conventions', () => {
    beforeEach(() => {
      step = new OrganizeCompiledBinariesStep({
        projectType: 'rust',
        platformTargets: []
      });
    });

    it('should generate correct names for different platforms', () => {
      const testCases = [
        {
          platform: 'windows',
          architecture: 'x86_64',
          target: 'debug',
          expected: 'libtest_project.windows.template_debug.x86_64.dll'
        },
        {
          platform: 'macos',
          architecture: 'universal',
          target: 'release',
          expected: 'libtest_project.macos.template_release.framework'
        },
        {
          platform: 'linux',
          architecture: 'arm64',
          target: 'debug',
          expected: 'libtest_project.linux.template_debug.arm64.so'
        },
        {
          platform: 'ios',
          architecture: 'universal',
          target: 'release',
          expected: 'libtest_project.ios.template_release.framework'
        },
        {
          platform: 'web',
          architecture: 'wasm32',
          target: 'debug',
          expected: 'libtest_project.web.template_debug.wasm32.wasm'
        }
      ];

      for (const testCase of testCases) {
        const result = (step as any).generateGodotBinaryName('test-project', testCase);
        expect(result).toBe(testCase.expected);
      }
    });

    it('should handle project names with hyphens correctly', () => {
      const result = (step as any).generateGodotBinaryName('my-awesome-project', {
        platform: 'windows',
        architecture: 'x86_64',
        target: 'release'
      });
      
      expect(result).toBe('libmy_awesome_project.windows.template_release.x86_64.dll');
    });
  });
});