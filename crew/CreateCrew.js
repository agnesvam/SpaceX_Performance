import http from 'k6/http';
import { check, sleep } from 'k6';
import { htmlReport } from "https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js";

export const options = {
  scenarios: {
    // Load Test - Focused load testing simulation
    load_test: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '30s', target: 10 },  // Warm up
        { duration: '2m', target: 30 },   // Main load
        { duration: '30s', target: 0 },   // Cool down
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    http_req_duration: ['avg < 500', 'p(95) < 1000'],
    http_req_failed: ['rate<0.05'],
    checks: ['rate>0.95'],
  }
};

export default function () {
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