/**
 * Unit tests for dependency resolution utilities
 */

import * as path from 'path';
import { ProjectGraph } from '@nx/devkit';
import { 
  resolveTransitiveDependencies,
  validateDependenciesBuilt,
  getProjectType,
  getRequiredProjectType
} from '../../lib/utils/dependency-resolution';
import { ProjectDependency, ProjectTypeEnum } from '../../lib/core/interfaces';
import { DependencyError, ConfigurationError } from '../../lib/core/errors';

// Mock file system operations
jest.mock('fs', () => ({
  existsSync: jest.fn(),
}));

import * as fs from 'fs';
const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;

describe('dependency-resolution utilities', () => {
  let mockProjectGraph: ProjectGraph;
  const workspaceRoot = '/workspace';

  beforeEach(() => {
    jest.clearAllMocks();
    mockExistsSync.mockReturnValue(true);

    // Setup a complex project graph for testing
    mockProjectGraph = {
      nodes: {
        'app': {
          name: 'app',
          type: 'application',
          data: { 
            root: 'app',
            targets: {
              build: {
                executor: 'godot-build-tools:godot-game',
                outputs: ['{projectRoot}/build']
              }
            }
          },
        },
        'lib-a': {
          name: 'lib-a',
          type: 'library',
          data: { 
            root: 'lib-a',
            targets: {
              build: {
                executor: 'godot-build-tools:godot-library',
                outputs: ['{projectRoot}/build']
              }
            }
          },
        },
        'lib-b': {
          name: 'lib-b',
          type: 'library',
          data: { 
            root: 'lib-b',
            targets: {
              build: {
                executor: 'godot-build-tools:godot-library',
                outputs: ['{projectRoot}/build']
              }
            }
          },
        },
        'lib-c': {
          name: 'lib-c',
          type: 'library',
          data: { 
            root: 'lib-c',
            targets: {
              build: {
                executor: 'godot-build-tools:gdextension',
                outputs: ['{projectRoot}/build']
              }
            }
          },
        },
      },
      dependencies: {
        'app': [
          { source: 'app', target: 'lib-a', type: 'static' },
          { source: 'app', target: 'lib-b', type: 'static' },
        ],
        'lib-a': [
          { source: 'lib-a', target: 'lib-c', type: 'static' },
        ],
        'lib-b': [
          { source: 'lib-b', target: 'lib-c', type: 'static' },
        ],
        'lib-c': [],
      },
    };
  });

  describe('resolveTransitiveDependencies', () => {
    it('should resolve simple dependencies', () => {
      const dependencies = resolveTransitiveDependencies('lib-a', mockProjectGraph, workspaceRoot);
      
      expect(dependencies).toHaveLength(1);
      expect(dependencies[0]).toEqual({
        name: 'lib-c',
        buildDir: '/workspace/lib-c/build'
      });
    });

    it('should resolve transitive dependencies', () => {
      const dependencies = resolveTransitiveDependencies('app', mockProjectGraph, workspaceRoot);
      
      expect(dependencies).toHaveLength(3);
      
      // Should include all transitive dependencies
      const depNames = dependencies.map(d => d.name).sort();
      expect(depNames).toEqual(['lib-a', 'lib-b', 'lib-c']);
      
      // Should have correct build directories
      expect(dependencies.find(d => d.name === 'lib-a')?.buildDir).toBe('/workspace/lib-a/build');
      expect(dependencies.find(d => d.name === 'lib-b')?.buildDir).toBe('/workspace/lib-b/build');
      expect(dependencies.find(d => d.name === 'lib-c')?.buildDir).toBe('/workspace/lib-c/build');
    });

    it('should handle projects with no dependencies', () => {
      const dependencies = resolveTransitiveDependencies('lib-c', mockProjectGraph, workspaceRoot);
      
      expect(dependencies).toHaveLength(0);
    });

    it('should detect circular dependencies', () => {
      // Create a circular dependency: lib-c -> lib-a
      const circularGraph: ProjectGraph = {
        ...mockProjectGraph,
        dependencies: {
          ...mockProjectGraph.dependencies,
          'lib-c': [
            { source: 'lib-c', target: 'lib-a', type: 'static' },
          ],
        },
      };

      expect(() => {
        resolveTransitiveDependencies('app', circularGraph, workspaceRoot);
      }).toThrow(DependencyError);
      
      expect(() => {
        resolveTransitiveDependencies('app', circularGraph, workspaceRoot);
      }).toThrow('Circular dependency detected');
    });

    it('should ignore self-references', () => {
      // Create a self-reference: lib-a -> lib-a
      const selfRefGraph: ProjectGraph = {
        ...mockProjectGraph,
        dependencies: {
          ...mockProjectGraph.dependencies,
          'lib-a': [
            { source: 'lib-a', target: 'lib-a', type: 'static' },
          ],
        },
      };

      // Should not throw and should return empty dependencies
      const dependencies = resolveTransitiveDependencies('lib-a', selfRefGraph, workspaceRoot);
      expect(dependencies).toHaveLength(0);
    });

    it('should throw error for missing dependency project', () => {
      // Add dependency to non-existent project
      const invalidGraph: ProjectGraph = {
        ...mockProjectGraph,
        dependencies: {
          ...mockProjectGraph.dependencies,
          'lib-a': [
            { source: 'lib-a', target: 'non-existent', type: 'static' },
          ],
        },
      };

      expect(() => {
        resolveTransitiveDependencies('lib-a', invalidGraph, workspaceRoot);
      }).toThrow(DependencyError);
      
      expect(() => {
        resolveTransitiveDependencies('lib-a', invalidGraph, workspaceRoot);
      }).toThrow("Dependency project 'non-existent' not found in project graph");
    });

    it('should not include the root project in dependencies', () => {
      // Even if there's a self-reference, it should be ignored
      const selfRefGraph: ProjectGraph = {
        ...mockProjectGraph,
        dependencies: {
          ...mockProjectGraph.dependencies,
          'app': [
            ...mockProjectGraph.dependencies['app'],
            { source: 'app', target: 'app', type: 'static' }, // Self-reference
          ],
        },
      };

      const dependencies = resolveTransitiveDependencies('app', selfRefGraph, workspaceRoot);
      
      // Should not include 'app' itself
      expect(dependencies.find(d => d.name === 'app')).toBeUndefined();
      expect(dependencies).toHaveLength(3); // lib-a, lib-b, lib-c
    });
  });

  describe('validateDependenciesBuilt', () => {
    const mockDependencies: ProjectDependency[] = [
      { name: 'dep1', buildDir: '/workspace/dep1/build' },
      { name: 'dep2', buildDir: '/workspace/dep2/build' },
    ];

    it('should pass when all dependencies are built', () => {
      mockExistsSync.mockReturnValue(true);
      
      expect(() => {
        validateDependenciesBuilt(mockDependencies, 'test-project');
      }).not.toThrow();
    });

    it('should throw error when some dependencies are not built', () => {
      mockExistsSync.mockImplementation((path) => {
        return path !== '/workspace/dep2/build'; // dep2 is not built
      });
      
      expect(() => {
        validateDependenciesBuilt(mockDependencies, 'test-project');
      }).toThrow(DependencyError);
      
      expect(() => {
        validateDependenciesBuilt(mockDependencies, 'test-project');
      }).toThrow('Missing build artifacts for dependencies: dep2');
    });

    it('should throw error when multiple dependencies are not built', () => {
      mockExistsSync.mockReturnValue(false); // None are built
      
      expect(() => {
        validateDependenciesBuilt(mockDependencies, 'test-project');
      }).toThrow(DependencyError);
      
      expect(() => {
        validateDependenciesBuilt(mockDependencies, 'test-project');
      }).toThrow('Missing build artifacts for dependencies: dep1, dep2');
    });

    it('should handle empty dependencies list', () => {
      expect(() => {
        validateDependenciesBuilt([], 'test-project');
      }).not.toThrow();
    });
  });

  describe('getProjectType', () => {
    it('should detect project type from projectType field', () => {
      const node = {
        name: 'test',
        type: 'library',
        data: {
          root: 'test',
          projectType: 'godot-library'
        }
      };

      expect(getProjectType(node)).toBe(ProjectTypeEnum.GODOT_LIBRARY);
    });

    it('should detect project type from executor', () => {
      const node = {
        name: 'test',
        type: 'library',
        data: {
          root: 'test',
          targets: {
            build: {
              executor: 'godot-build-tools:gdextension'
            }
          }
        }
      };

      expect(getProjectType(node)).toBe(ProjectTypeEnum.GDEXTENSION);
    });

    it('should return null for unsupported project type', () => {
      const node = {
        name: 'test',
        type: 'library',
        data: {
          root: 'test',
          targets: {
            build: {
              executor: 'some-other-executor'
            }
          }
        }
      };

      expect(getProjectType(node)).toBeNull();
    });

    it('should return null when no build target exists', () => {
      const node = {
        name: 'test',
        type: 'library',
        data: {
          root: 'test'
        }
      };

      expect(getProjectType(node)).toBeNull();
    });
  });

  describe('getRequiredProjectType', () => {
    it('should return project type when valid', () => {
      const node = {
        name: 'test',
        type: 'library',
        data: {
          root: 'test',
          projectType: 'godot-library'
        }
      };

      expect(getRequiredProjectType(node, 'test')).toBe(ProjectTypeEnum.GODOT_LIBRARY);
    });

    it('should throw ConfigurationError when project type is unsupported', () => {
      const node = {
        name: 'test',
        type: 'library',
        data: {
          root: 'test',
          targets: {
            build: {
              executor: 'some-other-executor'
            }
          }
        }
      };

      expect(() => {
        getRequiredProjectType(node, 'test');
      }).toThrow(ConfigurationError);
      
      expect(() => {
        getRequiredProjectType(node, 'test');
      }).toThrow('has an unsupported or unrecognized project type');
    });
  });
});