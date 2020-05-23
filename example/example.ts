import { App, Chart } from 'cdk8s';
import { Construct } from 'constructs';
import { Flux } from '../lib/index';

export class MyFlux extends Chart {
  constructor(scope: Construct, name: string) {
    super(scope, name);

    new Flux(this, 'flux', {
      ns: 'flux',
      name: 'flux',
      image: 'fluxcd/flux',
      tag: '1.19.0',
      replicas: 1,
      arguments: [
        '--memcached-service=',
        '--ssh-keygen-dir=/etc/fluxd/keygen',
        '--git-url=git@github.com:rafaribe/cdk8s-k3s-gitops.git',
        '--git-branch=master',
        '--git-path=cluster',
        '--git-label=flux',
        '--git-user=flux',
        '--git-email=flux@rafaribe.com',
        '--git-poll-interval=5m',
        '--sync-garbage-collection',
      ],
    });
  }
}

const app = new App();
new MyFlux(app, 'flux');
app.synth();
