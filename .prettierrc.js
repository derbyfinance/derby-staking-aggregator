module.exports = {
  semi: true,
  singleQuote: true,
  trailingComma: 'all',
  tabWidth: 2,
  printWidth: 100,
  overrides: [
    {
      files: "*.sol",
      options: {
        useTabs: false,
        singleQuote: false,
        bracketSpacing: false,
        explicitTypes: "preserve"
      }
    }
  ]
}