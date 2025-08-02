#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import { createProjectGraphAsync, ProjectGraph, ProjectGraphProjectNode } from '@nx/devkit';

export async function linkDeps(): Promise<void> {
  const workspaceRoot = path.resolve(__dirname, '../..');
  const projectName = process.env['NX_TASK_TARGET_PROJECT'];
  if (!projectName) {
    console.error('❌ NX_TASK_TARGET_PROJECT is not set.');
    process.exit(1);
  }

  const graph: ProjectGraph = await createProjectGraphAsync();
  const projectNode: ProjectGraphProjectNode | undefined = graph.nodes[projectName];
  if (!projectNode) {
    console.error(`❌ Project '${projectName}' not found.`);
    process.exit(1);
  }

  const projectRoot = projectNode.data.root;
  const projDir = path.join(workspaceRoot, projectRoot);
  const addonsDir = path.join(projDir, '_addons');

  // clean and create addons folder
  fs.rmSync(addonsDir, { recursive: true, force: true });
  fs.mkdirSync(addonsDir, { recursive: true });

  // collect transitive dependencies
  const deps: Set<string> = new Set();
  const queue: string[] = [projectName];
  while (queue.length) {
    const curr = queue.shift();
    if (!curr) continue;
    for (const { target } of graph.dependencies[curr] || []) {
      if (target !== projectName && !deps.has(target)) {
        deps.add(target);
        queue.push(target);
      }
    }
  }

  // link each dep's build outputs (excluding its own _addons)
  for (const dep of deps) {
    const node = graph.nodes[dep];
    if (!node) continue;
    const outputs = node.data.targets?.['build']?.outputs || [];
    for (const pattern of outputs) {
      if (pattern.includes('_addons')) continue;
      const raw = pattern
        .replace('{workspaceRoot}', workspaceRoot)
        .replace('{projectRoot}', node.data.root);
      const outputPath = path.isAbsolute(raw) ? raw : path.join(workspaceRoot, raw);
      if (!fs.existsSync(outputPath)) continue;
      const linkDest = path.join(addonsDir, dep);
      fs.symlinkSync(outputPath, linkDest, 'dir');
      console.log(`🔗 [${projectName}] ${dep} -> ${path.relative(workspaceRoot, linkDest)}`);
    }
  }
}

// If this file is run directly, execute the main function
if (require.main === module) {
  (async function main(): Promise<void> {
    await linkDeps();
    // ensure process exits (avoids hanging)
    process.on('beforeExit', () => process.exit(0));
  })();
}
