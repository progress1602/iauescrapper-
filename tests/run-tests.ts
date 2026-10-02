import { runScraperTestSuite } from './scraper.test';

async function main() {
  console.log('Starting IAUE Student Hub Scraper Subsystem Test Suite...\n');
  try {
    const { passed, failed } = await runScraperTestSuite();
    if (failed > 0) {
      console.error(`\n❌ Test suite failed with ${failed} failure(s).`);
      process.exit(1);
    } else {
      console.log(`\n🎉 All ${passed} tests passed successfully!`);
      process.exit(0);
    }
  } catch (err) {
    console.error('Fatal error during test suite execution:', err);
    process.exit(1);
  }
}

main();
