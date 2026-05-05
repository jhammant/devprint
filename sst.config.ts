/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: 'devprint',
      removal: input?.stage === 'prod' ? 'retain' : 'remove',
      home: 'aws',
      providers: {
        aws: { region: 'eu-west-2' },
      },
    };
  },
  async run() {
    const isProd = $app.stage === 'prod';

    const agent = new sst.aws.Function('Agent', {
      handler: 'infra/lambdas/agent/index.handler',
      url: true,
      memory: '512 MB',
      timeout: '10 seconds',
      environment: {
        DEVPRINT_TOOL_VERSION: '0.1.0',
        // GITHUB_TOKEN: set via `sst secret set GithubToken <value>` then re-link in this config.
      },
    });

    const badge = new sst.aws.Function('Badge', {
      handler: 'infra/lambdas/badge/index.handler',
      url: true,
      memory: '256 MB',
      timeout: '10 seconds',
    });

    const site = new sst.aws.StaticSite('Spa', {
      build: {
        command: 'npm run build',
        output: 'dist',
      },
      ...(isProd && {
        domain: {
          name: 'devprint.dev',
          aliases: ['www.devprint.dev'],
        },
      }),
    });

    const agentEdge = new sst.aws.Router('AgentEdge', {
      ...(isProd && {
        domain: { name: 'agents.devprint.dev' },
      }),
      routes: {
        '/*': agent.url,
      },
    });

    return {
      siteUrl: site.url,
      agentUrl: agentEdge.url,
      agentFunctionUrl: agent.url,
      badgeFunctionUrl: badge.url,
    };
  },
});
