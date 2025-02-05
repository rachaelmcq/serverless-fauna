const fauna = require('faunadb')
const { query: q } = fauna
const DeployQueriesMock = jest
  .fn()
  .mockReturnValue([{ query: q.Now(), name: 'mock' }])
jest.doMock('../../fauna/DeployQueries', () => DeployQueriesMock)

const DeployCommand = require('../../commands/DeployCommand')
const Logger = require('../../Logger')
const { BaseFQL, BaseFQLString, defaultData } = require('../test.data')

const logger = new Logger({
  log: () => jest.fn(),
})

const faunaClient = { query: jest.fn().mockResolvedValue() }

let command

describe('DeployCommand', () => {
  beforeAll(() => {
    command = new DeployCommand({
      faunaClient,
      config: {},
      logger,
    })
  })

  afterEach(() => {
    DeployQueriesMock.mockReset()
  })

  describe('Adapters', () => {
    describe('FunctionAdapter', () => {
      const fn = {
        name: 'test',
        body: BaseFQLString,
        data: { prop: 'prop' },
      }

      const compare = {
        name: 'test',
        role: null,
        body: q.Query(BaseFQL),
        data: { prop: 'prop' },
      }

      test('base', () => {
        expect(command.functionAdapter(fn)).toEqual({
          ...compare,
          data: { ...command.defaultMetadata, ...compare.data },
        })
      })

      test('with build-in role', () => {
        expect(command.functionAdapter({ ...fn, role: 'admin' })).toEqual({
          ...compare,
          data: { ...command.defaultMetadata, ...compare.data },
          role: 'admin',
        })
      })

      test('with custom role', () => {
        expect(command.functionAdapter({ ...fn, role: 'custom' })).toEqual({
          ...compare,
          data: { ...command.defaultMetadata, ...compare.data },
          role: q.Role('custom'),
        })
      })
    })

    describe('IndexAdapter', () => {
      test('source', () => {
        const cases = [
          {
            label: 'plain string',
            input: { name: 'name', source: 'source' },
            output: {
              name: 'name',
              data: command.defaultMetadata,
              source: [{ collection: q.Collection('source') }],
            },
          },
          {
            label: 'array of strings',
            input: { name: 'name', source: ['source', 'source2'] },
            output: {
              name: 'name',
              data: command.defaultMetadata,
              source: [
                {
                  collection: q.Collection('source'),
                },
                {
                  collection: q.Collection('source2'),
                },
              ],
            },
          },
          {
            label: 'source object',
            input: {
              name: 'name',
              source: { collection: 'source', fields: { bind: BaseFQLString } },
            },
            output: {
              name: 'name',
              data: command.defaultMetadata,
              source: [
                {
                  collection: q.Collection('source'),
                  fields: {
                    bind: q.Query(BaseFQL),
                  },
                },
              ],
            },
          },
        ]

        for (let { label, input, output } of cases) {
          expect(command.indexAdapter(input), label).toEqual(output)
        }
      })

      test('terms', () => {
        const cases = [
          {
            label: 'only fields',
            input: {
              name: 'name',
              source: 'source',
              terms: { fields: ['data.field1', 'data.field2'] },
            },
            output: {
              name: 'name',
              data: command.defaultMetadata,
              source: [{ collection: q.Collection('source') }],
              terms: [
                { field: ['data', 'field1'] },
                { field: ['data', 'field2'] },
              ],
            },
          },
          {
            label: 'with binding',
            input: {
              name: 'name',
              source: 'source',
              terms: {
                fields: ['data.field1', 'data.field2'],
                bindings: ['bind'],
              },
            },
            output: {
              name: 'name',
              data: command.defaultMetadata,
              source: [{ collection: q.Collection('source') }],
              terms: [
                { field: ['data', 'field1'] },
                { field: ['data', 'field2'] },
                { binding: 'bind' },
              ],
            },
          },
        ]

        for (let { label, input, output } of cases) {
          expect(command.indexAdapter(input), label).toEqual(output)
        }
      })

      test('values', () => {
        const cases = [
          {
            label: 'only fields',
            input: {
              name: 'name',
              source: 'source',
              values: { fields: ['data.field1', 'data.field2'] },
            },
            output: {
              name: 'name',
              data: command.defaultMetadata,
              source: [{ collection: q.Collection('source') }],
              values: [
                { field: ['data', 'field1'] },
                { field: ['data', 'field2'] },
              ],
            },
          },
          {
            label: 'with binding',
            input: {
              name: 'name',
              source: 'source',
              values: {
                fields: ['data.field1', 'data.field2'],
                bindings: ['bind'],
              },
            },
            output: {
              name: 'name',
              data: command.defaultMetadata,
              source: [{ collection: q.Collection('source') }],
              values: [
                { field: ['data', 'field1'] },
                { field: ['data', 'field2'] },
                { binding: 'bind' },
              ],
            },
          },
          {
            label: 'with reverse',
            input: {
              name: 'name',
              source: 'source',
              values: {
                fields: [{ path: 'data.field1', reverse: true }],
              },
            },
            output: {
              name: 'name',
              data: command.defaultMetadata,
              source: [{ collection: q.Collection('source') }],
              values: [{ field: ['data', 'field1'], reverse: true }],
            },
          },
        ]

        for (let { label, input, output } of cases) {
          expect(command.indexAdapter(input), label).toEqual(output)
        }
      })
    })

    describe('RoleAdapter', () => {
      test('boolean privileges', () => {
        expect(
          command.roleAdapter({
            name: 'name',
            privileges: [
              {
                index: 'index',
                actions: { read: true },
              },
              {
                function: 'function',
                actions: { read: true },
              },
              {
                databases: null,
                actions: { read: true },
              },
              {
                keys: null,
                actions: { read: true },
              },
            ],
          })
        ).toEqual({
          name: 'name',
          data: command.defaultMetadata,
          privileges: [
            { resource: q.Index('index'), actions: { read: true } },
            { resource: q.Function('function'), actions: { read: true } },
            { resource: q.Databases(), actions: { read: true } },
            { resource: q.Keys(), actions: { read: true } },
          ],
        })
      })

      test('predicate privileges', () => {
        expect(
          command.roleAdapter({
            name: 'name',
            privileges: [
              { collection: 'collection', actions: { read: BaseFQLString } },
            ],
          })
        ).toEqual({
          name: 'name',
          data: command.defaultMetadata,
          privileges: [
            {
              resource: q.Collection('collection'),
              actions: { read: q.Query(BaseFQL) },
            },
          ],
        })
      })

      test('membership', () => {
        const cases = [
          {
            label: 'plain string',
            input: {
              name: 'name',
              membership: 'membership',
              privileges: [
                { collection: 'collection', actions: { read: true } },
              ],
            },
            output: {
              name: 'name',
              data: command.defaultMetadata,
              privileges: [
                {
                  resource: q.Collection('collection'),
                  actions: { read: true },
                },
              ],
              membership: [{ resource: q.Collection('membership') }],
            },
          },

          {
            label: 'membership object',
            input: {
              name: 'name',
              membership: {
                resource: 'membership',
                predicate: BaseFQLString,
              },
              privileges: [
                { collection: 'collection', actions: { read: true } },
              ],
            },
            output: {
              name: 'name',
              data: command.defaultMetadata,
              privileges: [
                {
                  resource: q.Collection('collection'),
                  actions: { read: true },
                },
              ],
              membership: [
                {
                  resource: q.Collection('membership'),
                  predicate: q.Query(BaseFQL),
                },
              ],
            },
          },
        ]

        for (let { label, input, output } of cases) {
          expect(command.roleAdapter(input), label).toEqual(output)
        }
      })
    })

    describe('merge fauna & resource level deletion_policy', () => {
      test('fauna deletion_policy=retain', () => {
        const command = new DeployCommand({
          faunaClient,
          config: {
            deletion_policy: 'retain',
            collections: { test: { name: 'test' } },
            indexes: { test: { name: 'test', source: 'test' } },
            roles: { test: { name: 'test', privileges: [] } },
            functions: {
              test: { name: 'test', role: null, body: BaseFQLString },
            },
          },
          logger,
        })

        command.deploy()

        expect(DeployQueriesMock.mock.calls[0][0]).toEqual({
          collections: [
            {
              name: 'test',
              data: { ...defaultData, deletion_policy: 'retain' },
            },
          ],
          indexes: [
            {
              name: 'test',
              data: { ...defaultData, deletion_policy: 'retain' },
              source: [{ collection: q.Collection('test') }],
            },
          ],
          roles: [
            {
              name: 'test',
              data: { ...defaultData, deletion_policy: 'retain' },
              privileges: [],
            },
          ],
          functions: [
            {
              name: 'test',
              role: null,
              body: q.Query(BaseFQL),
              data: { ...defaultData, deletion_policy: 'retain' },
            },
          ],
        })
      })
    })
  })

  test('Deploy', () => {
    const command = new DeployCommand({
      faunaClient,
      logger,
      config: {
        collections: { users: { name: 'users' } },
        indexes: {
          user_by_email: { name: 'user_by_email', source: 'users' },
        },
        functions: {
          register: { name: 'register', body: BaseFQLString },
        },
        roles: {
          customer: {
            name: 'customer',
            membership: { resource: 'users', predicate: BaseFQLString },
            privileges: [{ index: 'user_by_email', actions: { read: true } }],
          },
        },
      },
    })

    command.deploy()
    expect(DeployQueriesMock.mock.calls[0][0]).toEqual({
      collections: [{ name: 'users', data: command.defaultMetadata }],
      indexes: [
        {
          name: 'user_by_email',
          data: command.defaultMetadata,
          source: [{ collection: q.Collection('users') }],
        },
      ],
      functions: [
        {
          name: 'register',
          data: command.defaultMetadata,
          body: q.Query(BaseFQL),
          role: null,
        },
      ],
      roles: [
        {
          name: 'customer',
          data: command.defaultMetadata,
          membership: [
            {
              resource: q.Collection('users'),
              predicate: q.Query(BaseFQL),
            },
          ],
          privileges: [
            { resource: q.Index('user_by_email'), actions: { read: true } },
          ],
        },
      ],
    })
  })

  describe('handleQueryError', () => {
    test('throw whole error if no result', () => {
      const errResp = new Error()
      expect(() => command.handleQueryError({ errResp })).toThrow(errResp)
    })

    test('throw whole error if no result', () => {
      const errResp = new Error()
      expect(() => command.handleQueryError({ errResp })).toThrow(errResp)
    })

    test("throw error desc if resp doesn't hav failure", () => {
      const errResp = {
        requestResult: {
          responseContent: { errors: [{ description: 'description' }] },
        },
      }
      expect(() =>
        command.handleQueryError({ errResp, name: 'query' })
      ).toThrow('query => description')
    })

    test('throw failures desc', () => {
      const errResp = {
        requestResult: {
          responseContent: {
            errors: [
              {
                failures: [
                  { field: 'failure_field', description: 'failure_desc' },
                  { field: 'failure_field_2', description: 'failure_desc_2' },
                ],
              },
            ],
          },
        },
      }
      expect(() =>
        command.handleQueryError({ errResp, name: 'query' })
      ).toThrow(
        'query => `failure_field`: failure_desc; `failure_field_2`: failure_desc_2'
      )
    })
  })
})
