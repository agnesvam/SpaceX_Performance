import http from 'k6/http';
import { check, sleep } from 'k6';
import { htmlReport } from "https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js";

// Get test configuration from environment variables
const TEST_TYPE = __ENV.TEST_TYPE || 'load';
const VUS = parseInt(__ENV.VUS) || 30;
const MAX_VUS = parseInt(__ENV.MAX_VUS) || 100;

// Define scenarios based on test type
const getScenarios = () => {
  if (TEST_TYPE === 'spike') {
    return {
      spike_test: {
        executor: 'ramping-vus',
        startVUs: 0,
        stages: [
          { duration: '10s', target: Math.floor(VUS * 0.1) },   // 10% of base VUs
          { duration: '10s', target: MAX_VUS },                  // Sudden spike to MAX_VUS
          { duration: '30s', target: MAX_VUS },                  // Hold spike
          { duration: '10s', target: Math.floor(VUS * 0.1) },   // Drop to 10%
          { duration: '10s', target: 0 },                        // Complete shutdown
        ],
        gracefulRampDown: '15s',
      },
    };
  } else {
    // Default to load test
    return {
      load_test: {
        executor: 'ramping-vus',
        startVUs: 1,
        stages: [
          { duration: '30s', target: Math.floor(VUS * 0.3) },   // Warm up to 30%
          { duration: '2m', target: VUS },                       // Main load
          { duration: '30s', target: 0 },                        // Cool down
        ],
        gracefulRampDown: '30s',
      },
    };
  }
};

export const options = {
  scenarios: getScenarios(),
  thresholds: {
    http_req_duration: TEST_TYPE === 'spike' ? ['avg < 1000', 'p(95) < 2000'] : ['avg < 500', 'p(95) < 1000'],
    http_req_failed: TEST_TYPE === 'spike' ? ['rate<0.15'] : ['rate<0.05'],
    checks: TEST_TYPE === 'spike' ? ['rate>0.85'] : ['rate>0.95'],
  }
};

export default function () {
  // Log test configuration (only once per VU)
  if (__ITER === 0) {
    console.log(`🚀 Running ${TEST_TYPE.toUpperCase()} TEST for Crew API`);
    console.log(`📊 Configuration: Base VUs: ${VUS}, Max VUs: ${MAX_VUS}`);
  }
  
  // Prepare crew member data for POST request
  const crewData = {
    name: `Test Crew ${__VU}-${__ITER}`,
    agency: "NASA",
    status: "active"
  };

  const headers = {
    'Content-Type': 'application/json',
  };


  const response = http.post(
    'https://jsonplaceholder.typicode.com/posts',
    JSON.stringify(crewData),
    { headers: headers }
  );
  
  check(response, {
    'status is 201': (r) => r.status === 201,
    'response time < 1000ms': (r) => r.timings.duration < 1000,
    'has valid response': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body && (body.id || body.name);
      } catch (e) {
        return false;
      }
    },
    'POST succeeded': (r) => r.status === 201 && r.body && r.body.length > 0,
  });

  sleep(1);
}

export function handleSummary(data) {
  return {
    'reports/CreateCrew.html': htmlReport(data),
  };
}
