import antfu from '@antfu/eslint-config'

export default antfu(
  {
    formatters: true,
  },
  {
    rules: {

      'antfu/no-top-level-await': 'off',
      'antfu/top-level-function': 'error',

      'arrow-body-style': 'off',
      'curly': ['error', 'multi-line'],
      'eslint-comments/no-unlimited-disable': 'off',
      'func-style': 'off',
      'no-console': ['off'],

      'no-param-reassign': 'error',
      'no-template-curly-in-string': 'off',
      'no-unlimited-disable': 'off',
      'object-shorthand': ['error', 'always'],
      'perfectionist/sort-classes': [
        'warn',
        {
          order: 'asc',
          type: 'natural',
        },
      ],
      'perfectionist/sort-objects': [
        'warn',
        {
          order: 'asc',
          type: 'natural',
        },
      ],
      'prefer-arrow-callback': 'error',
      'style/max-statements-per-line': ['error', { max: 2 }],
    },

  },
)
