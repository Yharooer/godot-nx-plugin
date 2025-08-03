/**
 * Unit tests for DependencyLinkingStep
 */

import { DependencyLinkingStep } from '../../lib/build-steps/dependency-linking-step';
import { BuildContext, ProjectDependency } from '../../lib/core/interfaces';
import { FileSystemError } from '../../lib/core/errors';

// Mock file operations
jest.mock('../../lib/utils/file-operations', () => ({
  ensureDirectoryExists: jest.fn(),
  createSymlink: jest.fn(),
}));

import { ensureDirectoryExists, createSymlink } from '../../lib/utils/file-operations';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { afterEach } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';


const mockEnsureDirectoryExists = ensureDirectoryExists as jest.MockedFunction<typeof ensureDirectoryExists>;
const mockCreateSymlink = createSymlink as jest.MockedFunction<typeof createSymlink>;

describe('DependencyLinkingStep', () => {
  let mockContext: BuildContext;
  let mockDependencies: ProjectDependency[];

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock console.log to avoid test output noise
    jest.spyOn(console, 'log').mockImplementation(() => {});

    // Setup mock dependencies
    mockDependencies = [
      { name: 'dep1', buildDir: '/workspace/dep1/build' },
      { name: 'dep2', buildDir: '/workspace/dep2/build' },
    ];

    // Setup mock context
    mockContext = {
      projectName: 'test-project',
      projectRoot: '/workspace/test-project',
      workspaceRoot: '/workspace',
      buildDir: '/workspace/test-project/build',
      dependencies: mockDependencies,
      options: {},
    };

    // Setup default mock implementations
    mockEnsureDirectoryExists.mockResolvedValue(undefined);
    mockCreateSymlink.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should set default options', () => {
      const step = new DependencyLinkingStep();
      expect(step.name).toBe('Dependency Linking');
    });
  });

  describe('execute', () => {
    it('should successfully link dependencies', async () => {
      const step = new DependencyLinkingStep();
      
      await step.execute(mockContext);

      // Should ensure _addons directory exists
      expect(mockEnsureDirectoryExists).toHaveBeenCalledWith(
        '/workspace/test-project/_addons'
      );

      // Should create symlinks for each dependency
      expect(mockCreateSymlink).toHaveBeenCalledTimes(2);
      expect(mockCreateSymlink).toHaveBeenCalledWith(
        '/workspace/dep1/build',
        '/workspace/test-project/_addons/dep1'
      );
      expect(mockCreateSymlink).toHaveBeenCalledWith(
        '/workspace/dep2/build',
        '/workspace/test-project/_addons/dep2'
      );
    });

    it('should handle empty dependencies list', async () => {
      const emptyContext = { ...mockContext, dependencies: [] };
      
      const step = new DependencyLinkingStep();
      
      await step.execute(emptyContext);

      // Should still ensure directory exists
      expect(mockEnsureDirectoryExists).toHaveBeenCalledWith(
        '/workspace/test-project/_addons'
      );
      
      // Should not create any symlinks
      expect(mockCreateSymlink).not.toHaveBeenCalled();
    });

    it('should handle errors from file operations', async () => {
      const fsError = new Error('Permission denied');
      mockCreateSymlink.mockRejectedValue(fsError);

      const step = new DependencyLinkingStep();
      
      await expect(step.execute(mockContext)).rejects.toThrow(FileSystemError);
      await expect(step.execute(mockContext)).rejects.toThrow('Failed to link dependencies');
    });

    it('should handle errors from directory creation', async () => {
      const fsError = new Error('Cannot create directory');
      mockEnsureDirectoryExists.mockRejectedValue(fsError);

      const step = new DependencyLinkingStep();
      
      await expect(step.execute(mockContext)).rejects.toThrow(FileSystemError);
      await expect(step.execute(mockContext)).rejects.toThrow('Failed to link dependencies');
    });
  });
});