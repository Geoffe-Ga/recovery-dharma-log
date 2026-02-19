/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Circular dependencies create tight coupling and maintenance issues',
      from: {},
      to: {
        circular: true,
      },
    },
    {
      name: 'no-orphans',
      severity: 'warn',
      comment: 'Orphaned modules may indicate dead code',
      from: {
        orphan: true,
        pathNot: ['\\.(test|spec)\\.[jt]sx?$', '\\.(stories)\\.[jt]sx?$'],
      },
      to: {},
    },
    {
      name: 'enforce-layers',
      severity: 'error',
      comment: 'Enforce layered architecture: presentation -> application -> domain',
      from: {
        path: '^src/domain',
      },
      to: {
        path: '^src/(presentation|application|infrastructure)',
      },
    },
    {
      name: 'domain-independence',
      severity: 'error',
      comment: 'Domain layer should not depend on infrastructure concerns',
      from: {
        path: '^src/domain',
      },
      to: {
        path: '^src/infrastructure',
      },
    },
  ],
  options: {
    doNotFollow: {
      path: 'node_modules',
    },
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: 'tsconfig.json',
    },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
    },
    reporterOptions: {
      dot: {
        collapsePattern: 'node_modules/[^/]+',
      },
      archi: {
        collapsePattern: '^(node_modules|packages/[^/]+/src)/[^/]+',
      },
    },
  },
};
