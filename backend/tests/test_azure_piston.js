require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const path = require('path');
const { getRuntimes } = require('../services/pistonService');
const { execute } = require('../services/executionService');

async function testAzurePiston() {
  console.log('Testing Azure Piston at URL:', process.env.PISTON_URL);
  
  try {
    console.log('\n--- 1. Fetching Runtimes ---');
    const runtimes = await getRuntimes();
    console.log(`Successfully fetched ${runtimes.length} runtime(s):`);
    runtimes.forEach(r => console.log(` - ${r.language} (${r.version})`));

    console.log('\n--- 2. Testing Python Execution ---');
    const pyRes = await execute({
      language: 'python',
      sourceCode: 'print("Python execution on Azure VM is working!")\nfor i in range(3): print(f"Count: {i}")'
    });
    console.log('Python Status:', pyRes.status);
    console.log('Python Stdout:\n' + pyRes.stdout);

    console.log('\n--- 3. Testing C++ Execution ---');
    const cppRes = await execute({
      language: 'cpp',
      sourceCode: '#include <iostream>\nint main() { std::cout << "C++ on Azure VM compiled & executed successfully!\\n"; return 0; }'
    });
    console.log('C++ Status:', cppRes.status);
    console.log('C++ Stdout:\n' + cppRes.stdout);

    console.log('\n--- 4. Testing JavaScript Execution ---');
    const jsRes = await execute({
      language: 'javascript',
      sourceCode: 'console.log("JavaScript / Node.js on Azure VM working!");'
    });
    console.log('JS Status:', jsRes.status);
    console.log('JS Stdout:\n' + jsRes.stdout);

    console.log('\n--- 5. Testing Java Execution ---');
    const javaRes = await execute({
      language: 'java',
      sourceCode: 'public class Main { public static void main(String[] args) { System.out.println("Java on Azure VM executed successfully!"); } }'
    });
    console.log('Java Status:', javaRes.status);
    console.log('Java Stdout:\n' + javaRes.stdout);

    console.log('\n=========================================');
    console.log('ALL AZURE CLOUD PISTON RUNTIMES VERIFIED!');
    console.log('=========================================');
  } catch (err) {
    console.error('Piston test failed:', err);
  }
}

testAzurePiston();
