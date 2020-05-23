import { Testing, Chart } from 'cdk8s';
import { Flux } from '../lib';
import { expect, test } from '@jest/globals';
test('minimal configuration', () => {
  // GIVEN
  const app = Testing.app();
  const chart = new Chart(app, 'test');

  // WHEN
  new Flux(chart, 'flux', {
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
  // THEN
  expect(Testing.synth(chart)).toMatchSnapshot();
});
