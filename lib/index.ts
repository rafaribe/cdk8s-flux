import { Construct } from 'constructs';
import {
  ClusterRole,
  ClusterRoleBinding,
  Deployment,
  Namespace,
  Probe,
  Quantity,
  Secret,
  Service,
  ServiceAccount,
  Volume,
} from '../imports/k8s';

export interface FluxOptions {
  /**
   * The image for flux (docker hub only)
   */
  readonly image: string;
  /**
   * The tag for the flux image
   */
  readonly tag: string;

  /**
   * The name for the flux container
   */
  readonly name: string;

  /**
   * The Namespace that should be used for the resources
   */
  readonly ns: string;

  /**
   * Number of replicas.
   *
   * @default 1
   */
  readonly replicas?: number;

  readonly memcachedTag?: string;

  /**
   * Flux Arguments
   *
   */
  readonly arguments: string[];
}

export class Flux extends Construct {
  constructor(scope: Construct, constructId: string, options: FluxOptions) {
    super(scope, constructId);
    const label = { name: options.name };

    const limits = {
      memory: Quantity.fromString('256Mi'),
      cpu: Quantity.fromString('150m'),
    };

    const fluxPort = 3030;
    const memcachedImageTag = options.memcachedTag ?? "1.5.2";

    new Namespace(this, options.ns, {
      metadata: {
        name: options.ns,
        labels: label,
      },
    });

    const serviceAccount = new ServiceAccount(this, options.name + 'sa', {
      metadata: {
        labels: label,
        name: options.name,
        namespace: options.ns,
      },
    });

    const clusterRole = new ClusterRole(this, options.name + '-cr', {
      metadata: {
        labels: label,
        name: options.name,
      },
      rules: [
        {
          apiGroups: ['*'],
          resources: ['*'],
          verbs: ['*'],
        },
        {
          nonResourceURLs: ['*'],
          verbs: ['*'],
        },
      ],
    });

    new ClusterRoleBinding(this, options.name + '-crb', {
      metadata: {
        labels: label,
        name: options.name,
      },
      roleRef: {
        apiGroup: 'rbac.authorization.k8s.io',
        kind: clusterRole.kind,
        name: clusterRole.name,
      },
      subjects: [
        {
          kind: serviceAccount.kind,
          name: serviceAccount.name,
          namespace: options.ns,
        },
      ],
    });

    const probe: Probe = {
      httpGet: {
        port: fluxPort,
        path: 'api/flux/v6/identity.pub',
      },
      initialDelaySeconds: 5,
      timeoutSeconds: 5,
    };
    const fluxGitDeploy = options.name + '-git-deploy';

    const volumes: Volume[] = [
      {
        name: 'git-key',
        secret: {
          secretName: fluxGitDeploy,
          defaultMode: 0o400,
        },
      },
      {
        name: 'git-keygen',
        emptyDir: { medium: 'Memory' },
      },
    ];

    new Secret(this, options.name + '-secret', {
      metadata: {
        name: fluxGitDeploy,
        namespace: options.ns,
      },
      type: 'Opaque',
    });

    new Deployment(this, options.name + '-dp', {
      metadata: {
        namespace: options.ns,
        name: options.name,
      },
      spec: {
        replicas: 1,
        selector: {
          matchLabels: label,
        },
        strategy: {
          type: 'Recreate',
        },
        template: {
          metadata: {
            labels: label,
          },
          spec: {
            serviceAccountName: serviceAccount.name,
            volumes: volumes,
            containers: [
              {
                name: options.name,
                image: options.image + ':' + options.tag,
                imagePullPolicy: 'IfNotPresent',
                ports: [{ containerPort: fluxPort }],
                resources: {
                  limits: limits,
                },
                livenessProbe: probe,
                readinessProbe: probe,
                volumeMounts: [
                  {
                    name: volumes[0].name,
                    mountPath: '/etc/fluxd/ssh',
                    readOnly: true,
                  },
                  {
                    name: volumes[1].name,
                    mountPath: '/etc/fluxd/keygen',
                  },
                ],
                args: options.arguments,
              },
            ],
          },
        },
      },
    });

    const memcachedName = 'memcached';
    const memcachedLabels = {
      name: memcachedName,
    };
    const memcachedPort: number = 11211;
    new Deployment(this, options.name + '-memcached', {
      metadata: {
        name: memcachedName,
        namespace: options.ns,
      },
      spec: {
        replicas: 1,
        selector: {
          matchLabels: memcachedLabels,
        },
        template: {
          metadata: {
            labels: memcachedLabels,
          },
          spec: {
            containers: [
              {
                name: memcachedName,
                image: 'memcached:' + memcachedImageTag,
                args: ['-m 512', '-I 5m', '-p ' + memcachedPort],
                ports: [
                  {
                    name: 'clients',
                    containerPort: memcachedPort,
                  },
                ],
                securityContext: {
                  runAsGroup: memcachedPort,
                  runAsUser: memcachedPort,
                  allowPrivilegeEscalation: false,
                },
              },
            ],
          },
        },
      },
    });
    new Service(this, memcachedName + '-svc', {
      metadata: {
        name: memcachedName,
        namespace: options.name,
      },
      spec: {
        ports: [
          {
            port: memcachedPort,
            name: memcachedName,
          },
        ],
        selector: {
          ['name']: memcachedName,
        },
      },
    });
  }
}
