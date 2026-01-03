const { StateGraph, START, END, Annotation } = require('@langchain/langgraph');
const puppeteer = require('puppeteer');
const TurndownService = require('turndown');
const { queryGrok } = require('./grokService');
const fs = require('fs');

// Custom state annotation using LangGraph Annotation.Root
const manusState = Annotation.Root({
  messages: Annotation([]),
  plan: Annotation([]),
  currentURL: Annotation(''),
  scratchpad: Annotation(''),
  weatherData: Annotation('') // Store crawled weather data
});

// Initialize Turndown service for HTML to Markdown conversion
const turndownService = new TurndownService();

// Web browsing function
async function browse_web(url) {
  console.log(`Browsing URL: ${url}`);

  // 1. Initialize headless browser
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();

    // Set user agent to avoid detection
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

    // 2. Navigate and wait for stable network
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait a bit more for dynamic content
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 3. Pure DOM Cleaning - remove scripts, styles, and other non-content elements
    await page.evaluate(() => {
      // Remove script tags
      const scripts = document.querySelectorAll('script');
      scripts.forEach(script => script.remove());

      // Remove style tags
      const styles = document.querySelectorAll('style');
      styles.forEach(style => style.remove());

      // Remove noscript tags
      const noscripts = document.querySelectorAll('noscript');
      noscripts.forEach(noscript => noscript.remove());

      // Remove navigation and footer elements (common patterns)
      const navs = document.querySelectorAll('nav, .nav, .navigation, .navbar');
      navs.forEach(nav => nav.remove());

      const footers = document.querySelectorAll('footer, .footer');
      footers.forEach(footer => footer.remove());

      // Remove ads and sidebars
      const ads = document.querySelectorAll('[class*="ad"], [id*="ad"], [class*="sidebar"], [id*="sidebar"]');
      ads.forEach(ad => ad.remove());
    });

    // Get cleaned HTML content
    const htmlContent = await page.content();

    // Convert HTML to Markdown
    const markdownContent = turndownService.turndown(htmlContent);

    // Slice content to no more than 8000 words
    const words = markdownContent.split(/\s+/);
    const slicedContent = words.length > 8000 ? words.slice(0, 8000).join(' ') : markdownContent;

    console.log(`Extracted ${words.length} words, sliced to ${slicedContent.split(/\s+/).length} words`);

    return {
      url: url,
      content: slicedContent,
      wordCount: slicedContent.split(/\s+/).length
    };

  } finally {
    await browser.close();
  }
}

// Planner node
async function planner(state) {
  console.log('🧠 PLANNER: Creating execution plan...');

  const plan = [
    'search weather website',
    'read weather info',
    'extract weather info of Vancouver',
    'save as CSV'
  ];

  const stepInfo = {
    node: 'planner',
    timestamp: new Date().toISOString(),
    action: 'Created execution plan',
    plan: plan,
    status: 'completed'
  };

  console.log('📋 Plan created:', plan);

  return {
    ...state,
    plan: plan,
    scratchpad: 'Planning phase completed. Ready to execute weather search.',
    steps: [...(state.steps || []), stepInfo]
  };
}

// Executor node
async function executor(state) {
  console.log('⚡ EXECUTOR: Executing current plan step...');

  if (!state.plan || state.plan.length === 0) {
    console.log('✅ All plans completed');
    return {
      ...state,
      scratchpad: 'All plans completed.',
      steps: [...(state.steps || []), {
        node: 'executor',
        timestamp: new Date().toISOString(),
        action: 'All plans completed',
        status: 'completed'
      }]
    };
  }

  const currentStep = state.plan[0];
  console.log(`🎯 Executing step: ${currentStep}`);

  let result = '';
  let stepDetails = {};

  try {
    switch (currentStep) {
      case 'search weather website':
        console.log('🔍 Searching for Vancouver weather websites...');
        const searchUrl = 'https://www.google.com/search?q=vancouver+weather+site';
        const searchResult = await browse_web(searchUrl);
        result = `Found weather search results. Content length: ${searchResult.wordCount} words`;
        stepDetails = { url: searchUrl, wordCount: searchResult.wordCount };
        console.log(`✅ Search completed: ${searchResult.wordCount} words found`);
        break;

      case 'read weather info':
        console.log('🌐 Reading weather information from Environment Canada...');
        const weatherUrl = 'https://weather.gc.ca/city/pages/bc-74_metric_e.html';
        const weatherResult = await browse_web(weatherUrl);

        // Store the weather data in state
        state.weatherData = weatherResult.content;

        result = `Weather data extracted: ${weatherResult.wordCount} words from ${weatherResult.url}`;
        stepDetails = { url: weatherUrl, wordCount: weatherResult.wordCount };
        console.log(`✅ Weather data extracted: ${weatherResult.wordCount} words from ${weatherUrl}`);
        break;

      case 'extract weather info of Vancouver':
        console.log('🧠 Extracting Vancouver weather info using Grok...');
        if (state.weatherData) {
          const extractionPrompt = 'Summarize the current weather for Vancouver in one simple sentence.';
          console.log('📋 EXTRACTION PROMPT:', extractionPrompt);
          console.log('📊 WEATHER DATA LENGTH:', state.weatherData.length, 'characters');
          const extractedInfo = await queryGrok(extractionPrompt, state.weatherData);
          result = `Vancouver weather info: ${extractedInfo}`;
          stepDetails = { extractedInfo: extractedInfo.substring(0, 100) + '...' };
          console.log(`✅ Weather info extracted: ${extractedInfo.substring(0, 100)}...`);
        } else {
          result = 'No weather data available to extract.';
          stepDetails = { error: 'No weather data available' };
          console.log('⚠️ No weather data available to extract');
        }
        break;

      case 'save as CSV':
        console.log('💾 Saving weather data to CSV file...');
        if (state.weatherData) {
          const csvData = `Weather Data for Vancouver\n${state.weatherData.replace(/\n/g, ' ')}\n`;
          fs.writeFileSync('vancouver_weather.csv', csvData);
          result = 'Weather data saved as CSV file (vancouver_weather.csv).';
          stepDetails = { file: 'vancouver_weather.csv', dataLength: csvData.length };
          console.log('✅ Weather data saved to vancouver_weather.csv');
        } else {
          result = 'No weather data to save.';
          stepDetails = { error: 'No weather data to save' };
          console.log('⚠️ No weather data to save');
        }
        break;

      default:
        result = `Unknown step: ${currentStep}`;
        stepDetails = { error: `Unknown step: ${currentStep}` };
        console.log(`❌ Unknown step: ${currentStep}`);
    }

    const stepInfo = {
      node: 'executor',
      timestamp: new Date().toISOString(),
      action: `Executed: ${currentStep}`,
      step: currentStep,
      result: result,
      details: stepDetails,
      status: 'completed'
    };

    return {
      ...state,
      currentURL: currentStep.includes('read weather') ? 'https://weather.gc.ca/city/pages/bc-74_metric_e.html' : state.currentURL,
      scratchpad: `Executed: ${currentStep}. Result: ${result}`,
      messages: [...state.messages, { role: 'assistant', content: result }],
      steps: [...(state.steps || []), stepInfo]
    };

  } catch (error) {
    console.error('❌ Executor error:', error);
    const errorStepInfo = {
      node: 'executor',
      timestamp: new Date().toISOString(),
      action: `Failed to execute: ${currentStep}`,
      step: currentStep,
      error: error.message,
      status: 'failed'
    };

    return {
      ...state,
      scratchpad: `Error executing ${currentStep}: ${error.message}`,
      messages: [...state.messages, { role: 'assistant', content: `Error: ${error.message}` }],
      steps: [...(state.steps || []), errorStepInfo]
    };
  }
}

// Replanner node
async function replanner(state) {
  console.log('🔄 REPLANNER: Replanning workflow...');

  if (!state.plan || state.plan.length === 0) {
    console.log('🎉 All tasks completed successfully');
    return {
      ...state,
      scratchpad: 'All tasks completed successfully.',
      steps: [...(state.steps || []), {
        node: 'replanner',
        timestamp: new Date().toISOString(),
        action: 'All tasks completed successfully',
        status: 'completed'
      }]
    };
  }

  // Remove the completed plan[0] and continue
  const remainingPlans = state.plan.slice(1);
  console.log(`✅ Task completed. Remaining tasks: ${remainingPlans.length}`);
  console.log(`📋 Next tasks: ${remainingPlans.join(', ') || 'None'}`);

  const stepInfo = {
    node: 'replanner',
    timestamp: new Date().toISOString(),
    action: 'Task completed, moving to next step',
    remainingPlans: remainingPlans,
    status: 'completed'
  };

  return {
    ...state,
    plan: remainingPlans,
    scratchpad: `Completed first task. Remaining tasks: ${remainingPlans.length}`,
    steps: [...(state.steps || []), stepInfo]
  };
}

// Conditional function to decide next step
function shouldContinue(state) {
  return state.plan && state.plan.length > 0 ? 'executor' : END;
}

// Build the graph
const workflow = new StateGraph(manusState)
  .addNode('planner', planner)
  .addNode('executor', executor)
  .addNode('replanner', replanner)
  .addEdge(START, 'planner')
  .addEdge('planner', 'executor')
  .addEdge('executor', 'replanner')
  .addConditionalEdges('replanner', shouldContinue, {
    'executor': 'executor',
    [END]: END
  });

// Compile the graph
const app = workflow.compile();

// Console message capture
let consoleMessages = [];

// Override console.log to capture messages
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

console.log = function(...args) {
  const message = args.join(' ');
  const timestamp = new Date().toISOString();
  consoleMessages.push({ type: 'log', message, timestamp });
  originalConsoleLog.apply(console, args);
};

console.error = function(...args) {
  const message = args.join(' ');
  const timestamp = new Date().toISOString();
  consoleMessages.push({ type: 'error', message, timestamp });
  originalConsoleError.apply(console, args);
};

// Main weather agent function
async function weatherAgent(query) {
  // Reset console messages for new query
  consoleMessages = [];

  console.log('🚀 Starting weather agent with query:', query);

  const initialState = {
    messages: [{ role: 'user', content: query }],
    plan: [],
    currentURL: '',
    scratchpad: '',
    weatherData: '',
    steps: [] // Track detailed steps
  };

  try {
    const result = await app.invoke(initialState);
    console.log('✅ LangGraph workflow completed');
    console.log('📊 Final state:', {
      plan: result.plan,
      currentURL: result.currentURL,
      scratchpad: result.scratchpad,
      weatherDataLength: result.weatherData?.length || 0,
      stepsCount: result.steps?.length || 0
    });

    // Use Grok to generate a comprehensive answer based on the crawled weather data
    let finalAnswer = 'Weather information for Vancouver has been processed and saved.';

    if (result.weatherData) {
      console.log('🤖 Querying Grok with weather data for final summary...');
      const grokPrompt = `Give me a simple weather summary for Vancouver in one sentence.`;
      console.log('📋 FINAL SUMMARY PROMPT:', grokPrompt);
      console.log('📊 FINAL WEATHER DATA LENGTH:', result.weatherData.length, 'characters');
      finalAnswer = await queryGrok(grokPrompt, result.weatherData);
      console.log('✅ Grok response received:', finalAnswer.substring(0, 100) + '...');
    }

    return {
      success: true,
      result: result,
      finalAnswer: finalAnswer,
      steps: result.steps || [], // Include detailed steps in response
      consoleMessages: consoleMessages // Include console messages in response
    };

  } catch (error) {
    console.error('❌ Weather agent error:', error);
    return {
      success: false,
      error: error.message,
      steps: [],
      consoleMessages: consoleMessages
    };
  }
}

module.exports = { weatherAgent };
