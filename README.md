# Manus AI Agent: LangGraph Weather Assistant

A complete guide to building an intelligent AI agent using LangGraph. This project demonstrates how to create a **Manus-style AI agent** that autonomously searches, crawls, and analyzes information to provide intelligent answers.

## 🎯 What is Manus?

**Manus** is an AI agent that can autonomously:
- **Plan** complex tasks step-by-step
- **Execute** web searches and data collection
- **Analyze** information using AI models
- **Provide** intelligent, context-aware responses

This project builds a **Weather Manus** - an AI agent that automatically finds and summarizes weather information for any location.

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   USER QUERY    │───▶│   LANGGRAPH     │───▶│   AI RESPONSE   │
│                 │    │   WORKFLOW      │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
            ┌───────▼───────┐   ┌──────▼──────┐
            │   PLANNER     │   │   EXECUTOR   │
            │               │   │              │
            │ • Create plan │   │ • Web crawl  │
            │ • Set goals   │   │ • Extract data│
            │ • Define steps│   │ • Process info│
            └───────┬───────┘   └──────┬───────┘
                    │                 │
                    └─────────┬───────┘
                              │
                    ┌─────────▼─────────┐
                    │   REPLANNER       │
                    │                   │
                    │ • Check progress │
                    │ • Update plan    │
                    │ • Continue/Stop  │
                    └───────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18+ (for native fetch support)
- **npm** or yarn
- **Grok API key** from [xAI Console](https://console.x.ai/)

### 1. Clone & Setup

```bash
git clone <your-repo-url>
cd LangGraph

# Backend setup
cd backend
npm install
cp .env.example .env  # Add your GROK_API_KEY

# Frontend setup
cd ../frontend
npm install
```

### 2. Configure Environment

Create `backend/.env` (copy from .env.example):
```bash
cd backend
cp .env.example .env
# Then edit .env and add your GROK_API_KEY
```

```env
PORT=3001
GROK_API_KEY=your-grok-api-key-here
```

### 3. Launch the Agent

```bash
# Terminal 1: Backend
cd backend && npm start

# Terminal 2: Frontend
cd frontend && npm start
```

**Open http://localhost:3000** and ask: *"What's the weather in Vancouver?"*

## 🧠 How to Build a Manus AI Agent

### Step 1: Define Your Agent's Purpose

Every AI agent needs a clear mission. For our Weather Manus:

```javascript
// The agent knows it should search, crawl, and analyze weather data
const AGENT_PURPOSE = "Find and summarize weather information autonomously"
```

### Step 2: Design the State Structure

LangGraph uses a **state machine**. Define what information your agent needs:

```javascript
const manusState = Annotation.Root({
  messages: Annotation([]),      // Conversation history
  plan: Annotation([]),          // Current execution plan
  currentURL: Annotation(''),    // Active webpage
  scratchpad: Annotation(''),    // Working notes
  weatherData: Annotation(''),   // Collected data
  steps: Annotation([])          // Execution tracking
});
```

### Step 3: Create the Planner Node

The **Planner** breaks down complex tasks into executable steps:

```javascript
async function planner(state) {
  // Analyze the user's query
  // Create a step-by-step execution plan
  const plan = [
    'search weather website',
    'read weather info',
    'extract weather info',
    'save as CSV'
  ];

  return { ...state, plan };
}
```

### Step 4: Build the Executor Node

The **Executor** performs the actual work:

```javascript
async function executor(state) {
  const currentStep = state.plan[0];

  switch (currentStep) {
    case 'search weather website':
      // Use Puppeteer to search Google
      const searchData = await browse_web('https://google.com/search?q=vancouver+weather');
      break;

    case 'read weather info':
      // Crawl official weather sites
      const weatherData = await browse_web('https://weather.gc.ca/city/pages/bc-74_metric_e.html');
      state.weatherData = weatherData.content;
      break;

    case 'extract weather info':
      // Use AI to analyze the data
      const summary = await queryGrok('Summarize Vancouver weather', weatherData);
      break;
  }

  return state;
}
```

### Step 5: Implement the Replanner Node

The **Replanner** manages workflow progress:

```javascript
async function replanner(state) {
  // Remove completed step
  const remainingPlans = state.plan.slice(1);

  // Check if we're done
  if (remainingPlans.length === 0) {
    return { ...state, plan: remainingPlans };
  }

  // Continue with next step
  return { ...state, plan: remainingPlans };
}
```

### Step 6: Connect Everything with LangGraph

```javascript
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

const agent = workflow.compile();
```

### Step 7: Add Web Crawling Capabilities

```javascript
async function browse_web(url) {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  await page.goto(url, { waitUntil: 'networkidle2' });

  // Clean the DOM (remove ads, scripts, etc.)
  await page.evaluate(() => {
    document.querySelectorAll('script, style, nav, footer').forEach(el => el.remove());
  });

  const content = await page.content();

  // Convert HTML to Markdown for better AI processing
  const markdown = turndownService.turndown(content);

  await browser.close();

  return {
    url,
    content: markdown.slice(0, 8000), // Limit content
    wordCount: markdown.split(' ').length
  };
}
```

### Step 8: Integrate AI Analysis

```javascript
async function queryGrok(prompt, context) {
  const messages = [
    {
      role: 'system',
      content: 'You are a weather assistant. Provide simple summaries.'
    },
    {
      role: 'user',
      content: context ? `${context}\n\n${prompt}` : prompt
    }
  ];

  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROK_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messages,
      model: 'grok-4-1-fast-non-reasoning',
      temperature: 0.7
    })
  });

  const data = await response.json();
  return data.choices[0].message.content;
}
```

## 🎨 Frontend: ChatGPT-Style Interface

Create an intuitive interface for your AI agent:

```jsx
function App() {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (query) => {
    setIsLoading(true);

    const response = await fetch('/api/weather', {
      method: 'POST',
      body: JSON.stringify({ query })
    });

    const result = await response.json();
    setMessages(prev => [...prev, result.finalAnswer]);
    setIsLoading(false);
  };

  return (
    <div className="chat-interface">
      {/* Message bubbles */}
      {/* Input field */}
      {/* Debug panels */}
    </div>
  );
}
```

## 📊 Key Concepts Learned

### 1. **Autonomous Planning**
- AI agents must break down complex tasks
- Create executable step-by-step plans
- Adapt plans based on results

### 2. **State Management**
- Track conversation history
- Maintain execution context
- Persist intermediate results

### 3. **Web Interaction**
- Headless browsers for automation
- DOM cleaning and content extraction
- Rate limiting and error handling

### 4. **AI Integration**
- Context-aware prompts
- Model selection for different tasks
- Response parsing and validation

### 5. **Error Recovery**
- Handle network failures
- Retry mechanisms
- Graceful degradation

## 🔧 Advanced Features

### Debug Visualization
```javascript
// Track every step of execution
const stepInfo = {
  node: 'executor',
  action: `Executed: ${currentStep}`,
  timestamp: new Date().toISOString(),
  details: { wordCount, url, status: 'completed' }
};
state.steps.push(stepInfo);
```

### Console Logging
```javascript
// Override console to capture all logs
const originalLog = console.log;
console.log = (...args) => {
  consoleMessages.push({
    type: 'log',
    message: args.join(' '),
    timestamp: new Date().toISOString()
  });
  originalLog(...args);
};
```

## 🚀 Building Your Own Manus Agent

1. **Choose a Domain**: Weather, research, coding, etc.
2. **Design State**: What information does your agent need?
3. **Create Nodes**: Planner → Executor → Replanner pattern
4. **Add Tools**: Web browsing, APIs, databases
5. **Integrate AI**: Choose appropriate models for analysis
6. **Build UI**: Create intuitive interfaces for interaction

## 📈 Scaling Your Agent

- **Multiple Data Sources**: Combine information from various APIs
- **Parallel Execution**: Run multiple steps simultaneously
- **Memory Management**: Handle conversation history
- **Error Recovery**: Robust failure handling
- **Performance Monitoring**: Track execution times and success rates

## 🎯 Real-World Applications

- **Research Assistant**: Automatically gather and summarize information
- **Data Analyst**: Extract insights from multiple sources
- **Content Creator**: Generate articles from web research
- **Customer Support**: Answer questions using knowledge bases
- **Code Assistant**: Analyze codebases and provide recommendations

---

**This Weather Manus demonstrates the core principles of building autonomous AI agents. The same architecture can be applied to create agents for any domain - research, analysis, automation, or assistance.**

## 🚀 Deployment

### Production Build

```bash
# Backend production build
cd backend
npm run build  # If you add build scripts

# Frontend production build
cd frontend
npm run build
```

### Docker Deployment (Optional)

```dockerfile
# Dockerfile for the complete application
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY . .

# Build frontend
RUN cd frontend && npm run build

EXPOSE 3001
CMD ["npm", "start"]
```

## 🤝 Contributing

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Development Guidelines

- **Test your changes** thoroughly
- **Add comments** for complex logic
- **Update documentation** for new features
- **Follow the existing code style**
- **Ensure all tests pass**

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **LangGraph** for the workflow orchestration framework
- **xAI** for the Grok AI model
- **Puppeteer** for web automation capabilities
- **React** for the frontend framework

## 🔗 Useful Links

- [LangGraph Documentation](https://langchain-ai.github.io/langgraph/)
- [Grok API Documentation](https://console.x.ai/)
- [Puppeteer Documentation](https://pptr.dev/)
- [React Documentation](https://reactjs.org/)

---

**Built with ❤️ using cutting-edge AI and automation technologies**

🌟 **Happy building your own AI agents!** 🌟
