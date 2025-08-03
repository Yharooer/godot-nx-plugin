/**
 * Integration tests for the new executor infrastructure
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ExecutorContext } from '@nx/devkit';
import { CleanExecutor } from '../../lib/executors/clean/executor';
import { LinkDepsExecutor } from '../../lib/executors/link-deps/executor';
import { GodotLibraryExecutor } from '../../lib/executors/godot-library/executor';

// Mock the NX devkit functions
jest.mock('@nx/devkit', () => ({
  readCachedProjectGraph: jest.fn(),
}));

jest.mock('../../lib/utils/dependency-resolution', () => ({
  resolveTransitiveDependencies: jest.fn(),
  validateProjectConfiguration: jest.fn(),
  validateDependenciesBuilt: jest.fn(),
}));

import { readCachedProjectGraph } from '@nx/devkit';
import {
  resolveTransitiveDependencies,
  validateProjectConfiguration,
  validateDependenciesBuilt,
} from '../../lib/utils/dependency-resolution';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { afterEach } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';


const mockReadCachedProjectGraph = readCachedProjectGraph as jest.MockedFunction<typeof readCachedProjectGraph>;
const mockResolveTransitiveDependencies = resolveTransitiveDependencies as jest.MockedFunction<typeof resolveTransitiveDependencies>;
const mockValidateProjectConfiguration = validateProjectConfiguration as jest.MockedFunction<typeof validateProjectConfiguration>;
const mockValidateDependenciesBuilt = validateDependenciesBuilt as jest.MockedFunction<typeof validateDependenciesBuilt>;

describe('Executor Infrastructure Integration Tests', () => {
  let tempDir: string;
  let projectRoot: string;
  let workspaceRoot: string;
  let mockContext: ExecutorContext;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create temporary directories for testing
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'executor-test-'));
    workspaceRoot = tempDir;
    projectRoot = path.join(tempDir, 'test-project');
    
    // Create project directory
    fs.mkdirSync(projectRoot, { recursive: true });

    // Create some test files
    fs.writeFileSync(path.join(projectRoot, 'test.gd'), 'extends Node');
    fs.writeFileSync(path.join(projectRoot, 'project.godot'), '[application]');

    mockContext = {
      root: workspaceRoot,
      projectName: 'test-project',
      targetName: 'build',
      configurationName: undefined,
      target: {
        executor: '@yharooer/godot-build-tools:godot-library',
      },
      workspace: {
        version: 2,
        projects: {
          'test-project': {
            root: 'test-project',
          },
        },
      },
    };

    // Mock NX dependencies
    mockReadCachedProjectGraph.mockReturnValue({
      nodes: {
        'test-project': {
          name: 'test-project',
          type: 'lib',
          data: {
            root: 'test-project',
            targets: {
              build: {
                executor: '@yharooer/godot-build-tools:godot-library',
                outputs: ['{projectRoot}/build'],
              },
            },
          },
        },
      },
      dependencies: {
        'test-project': [],
      },
    });

    mockResolveTransitiveDependencies.mockReturnValue([]);
    mockValidateProjectConfiguration.mockImplementation(() => {});
    mockValidateDependenciesBuilt.mockImplementation(() => {});
  });

  afterEach(() => {
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('CleanExecutor', () => {
    it('should clean build and _addons directories', async () => {
      // Create directories to clean
      const buildDir = path.join(projectRoot, 'build');
      const addonsDir = path.join(projectRoot, '_addons');
      
      fs.mkdirSync(buildDir, { recursive: true });
      fs.mkdirSync(addonsDir, { recursive: true });
      
      fs.writeFileSync(path.join(buildDir, 'test.txt'), 'test');
      fs.writeFileSync(path.join(addonsDir, 'test.txt'), 'test');

      // Verify directories exist
      expect(fs.existsSync(buildDir)).toBe(true);
      expect(fs.existsSync(addonsDir)).toBe(true);

      // Execute clean
      const executor = new CleanExecutor({}, mockContext);
      const result = await executor.execute();

      expect(result.success).toBe(true);
      expect(fs.existsSync(buildDir)).toBe(false);
      expect(fs.existsSync(addonsDir)).toBe(false);
    });

    it('should clean only specified directories', async () => {
      // Create directories
      const buildDir = path.join(projectRoot, 'build');
      const addonsDir = path.join(projectRoot, '_addons');
      
      fs.mkdirSync(buildDir, { recursive: true });
      fs.mkdirSync(addonsDir, { recursive: true });
      
      fs.writeFileSync(path.join(buildDir, 'test.txt'), 'test');
      fs.writeFileSync(path.join(addonsDir, 'test.txt'), 'test');

      // Execute clean with only cleanBuild: true
      const executor = new CleanExecutor({ cleanBuild: true, cleanAddons: false }, mockContext);
      const result = await executor.execute();

      expect(result.success).toBe(true);
      expect(fs.existsSync(buildDir)).toBe(false);
      expect(fs.existsSync(addonsDir)).toBe(true);
    });
  });

  describe('LinkDepsExecutor', () => {
    it('should create _addons directory when no dependencies exist', async () => {
      const executor = new LinkDepsExecutor({ cleanBuild: false }, mockContext);
      const result = await executor.execute();

      expect(result.success).toBe(true);
      expect(fs.existsSync(path.join(projectRoot, '_addons'))).toBe(true);
    });

    it('should clean _addons directory when cleanBuild is true', async () => {
      // Create _addons directory with existing content
      const addonsDir = path.join(projectRoot, '_addons');
      fs.mkdirSync(addonsDir, { recursive: true });
      fs.writeFileSync(path.join(addonsDir, 'old-file.txt'), 'old content');

      const executor = new LinkDepsExecutor({ cleanBuild: true }, mockContext);
      const result = await executor.execute();

      expect(result.success).toBe(true);
      expect(fs.existsSync(addonsDir)).toBe(true);
      expect(fs.existsSync(path.join(addonsDir, 'old-file.txt'))).toBe(false);
    });
  });

  describe('GodotLibraryExecutor', () => {
    it('should create build directory with project files', async () => {
      const executor = new GodotLibraryExecutor({ cleanBuild: false }, mockContext);
      const result = await executor.execute();

      expect(result.success).toBe(true);
      
      const buildDir = path.join(projectRoot, 'build');
      expect(fs.existsSync(buildDir)).toBe(true);
      
      // Check that project files were symlinked (excluding excluded patterns)
      expect(fs.existsSync(path.join(buildDir, 'test.gd'))).toBe(true);
      expect(fs.existsSync(path.join(buildDir, 'project.godot'))).toBe(false); // Should be excluded
    });

    it('should clean directories when cleanBuild is true', async () => {
      // Create existing directories with content
      const buildDir = path.join(projectRoot, 'build');
      const addonsDir = path.join(projectRoot, '_addons');
      
      fs.mkdirSync(buildDir, { recursive: true });
      fs.mkdirSync(addonsDir, { recursive: true });
      
      fs.writeFileSync(path.join(buildDir, 'old-build.txt'), 'old');
      fs.writeFileSync(path.join(addonsDir, 'old-addon.txt'), 'old');

      const executor = new GodotLibraryExecutor({ cleanBuild: true }, mockContext);
      const result = await executor.execute();

      expect(result.success).toBe(true);
      
      // Directories should exist but old content should be gone
      expect(fs.existsSync(buildDir)).toBe(true);
      expect(fs.existsSync(addonsDir)).toBe(true);
      expect(fs.existsSync(path.join(buildDir, 'old-build.txt'))).toBe(false);
      expect(fs.existsSync(path.join(addonsDir, 'old-addon.txt'))).toBe(false);
      
      // New content should be present
      expect(fs.existsSync(path.join(buildDir, 'test.gd'))).toBe(true);
    });
  });

  describe('Error handling', () => {
    it('should handle missing project gracefully', async () => {
      const badContext = {
        ...mockContext,
        projectName: undefined,
      };

      const executor = new CleanExecutor({}, badContext);
      const result = await executor.execute();

      expect(result.success).toBe(false);
      expect(result.error).toContain('No project name provided');
    });

    it('should handle validation errors gracefully', async () => {
      // Mock validation to throw an error
      mockValidateProjectConfiguration.mockImplementation(() => {
        throw new Error('Invalid project configuration');
      });

      const executor = new CleanExecutor({}, mockContext);
      const result = await executor.execute();

      // Should handle the error gracefully
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid project configuration');
    });
  });
});