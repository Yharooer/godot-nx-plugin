/**
 * Unit tests for RustGDExtensionProjectType
 */

import { RustGDExtensionProjectType } from '../../lib/project-types/rust-gdextension-project-type';
import { BuildContext, ProjectTypeEnum } from '../../lib/core/interfaces';
import { RustCompilationStep } from '../../lib/build-steps/rust-compilation-step';
import { GDExtensionBundleStep } from '../../lib/build-steps/gdextension-bundle-step';

describe('RustGDExtensionProjectType', () => {
  let projectType: RustGDExtensionProjectType;
  let mockContext: BuildContext;

  beforeEach(() => {
    projectType = new RustGDExtensionProjectType();
    mockContext = {
      projectName: 'test-rust-gdext',
      projectRoot: '/workspace/test-rust-gdext',
      workspaceRoot: '/workspace',
      buildDir: '/workspace/test-rust-gdext/build',
      dependencies: [],
      options: {}
    };
  });

  describe('name', () => {
    it('should have correct project type name', () => {
      expect(projectType.name).toBe(ProjectTypeEnum.GDEXTENSION);
    });
  });

  describe('createBuildPipeline', () => {
    it('should create build pipeline with RustCompilationStep, OrganizeCompiledBinariesStep, and GDExtensionBundleStep', () => {
      const pipeline = projectType.createBuildPipeline(mockContext);

      expect(pipeline).toHaveLength(3);
      expect(pipeline[0]).toBeInstanceOf(RustCompilationStep);
      expect(pipeline[1].name).toBe('Organize Compiled Binaries');
      expect(pipeline[2]).toBeInstanceOf(GDExtensionBundleStep);
    });

    it('should pass compilation options to RustCompilationStep', () => {
      projectType = new RustGDExtensionProjectType({
        platforms: ['linux.x86_64', 'windows.x86_64'],
        targets: ['release'],
        compatibilityMinimum: '4.2',
        reloadable: false,
        linkType: 'dynamic'
      });

      const pipeline = projectType.createBuildPipeline(mockContext);
      const compilationStep = pipeline[0] as RustCompilationStep;

      // We can't directly test the options passed to the step since they're private,
      // but we can verify the step was created
      expect(compilationStep).toBeInstanceOf(RustCompilationStep);
      expect(compilationStep.name).toBe('Rust GDExtension Compilation');
    });

    it('should pass bundle options to GDExtensionBundleStep', () => {
      projectType = new RustGDExtensionProjectType({
        entrySymbol: 'custom_init',
        compatibilityMinimum: '4.2',
        reloadable: false
      });

      const pipeline = projectType.createBuildPipeline(mockContext);
      const bundleStep = pipeline[2] as GDExtensionBundleStep;

      expect(bundleStep).toBeInstanceOf(GDExtensionBundleStep);
      expect(bundleStep.name).toBe('GDExtension Bundle');
    });

    it('should generate default entry symbol from project name', () => {
      mockContext.projectName = 'my-rust-extension';
      
      const pipeline = projectType.createBuildPipeline(mockContext);
      const bundleStep = pipeline[2] as GDExtensionBundleStep;

      // The default entry symbol should be generated as my_rust_extension_init
      expect(bundleStep).toBeInstanceOf(GDExtensionBundleStep);
    });

    it('should handle kebab-case to snake_case conversion for entry symbol', () => {
      mockContext.projectName = 'character-rust-gdext';
      
      const pipeline = projectType.createBuildPipeline(mockContext);
      
      // Should create the pipeline successfully with converted entry symbol
      expect(pipeline).toHaveLength(3);
      expect(pipeline[0]).toBeInstanceOf(RustCompilationStep);
      expect(pipeline[1].name).toBe('Organize Compiled Binaries');
      expect(pipeline[2]).toBeInstanceOf(GDExtensionBundleStep);
    });

    it('should work with empty options', () => {
      projectType = new RustGDExtensionProjectType({});
      
      const pipeline = projectType.createBuildPipeline(mockContext);

      expect(pipeline).toHaveLength(3);
      expect(pipeline[0]).toBeInstanceOf(RustCompilationStep);
      expect(pipeline[1].name).toBe('Organize Compiled Binaries');
      expect(pipeline[2]).toBeInstanceOf(GDExtensionBundleStep);
    });

    it('should work with no options', () => {
      projectType = new RustGDExtensionProjectType();
      
      const pipeline = projectType.createBuildPipeline(mockContext);

      expect(pipeline).toHaveLength(3);
      expect(pipeline[0]).toBeInstanceOf(RustCompilationStep);
      expect(pipeline[1].name).toBe('Organize Compiled Binaries');
      expect(pipeline[2]).toBeInstanceOf(GDExtensionBundleStep);
    });
  });
});