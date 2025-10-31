
import http from 'k6/http';
import { check, sleep } from 'k6';
import { htmlReport } from "https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js";

const rocketIds = JSON.parse(open('./rocket-ids.json'));

// Get test type from environment variable (default to 'load')
const TEST_TYPE = __ENV.TEST_TYPE || 'load';

// Define scenarios based on test type
const getScenarios = () => {
if (TEST_TYPE === 'spike') {
return {
spike_test: {
executor: 'ramping-vus',
startVUs: 0,
stages: [
{ duration: '10s', target: 5 }, // Normal load
{ duration: '10s', target: 100 }, // Sudden spike
{ duration: '30s', target: 100 }, // Hold spike
{ duration: '10s', target: 5 }, // Drop to normal
{ duration: '10s', target: 0 }, // Complete shutdown
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
{ duration: '30s', target: 10 }, // Warm up
{ duration: '2m', target: 30 }, // Main load
{ duration: '30s', target: 0 }, // Cool down
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
// Log test type info (only once per VU)
if (__ITER === 0) {
console.log(`🚀 Running ${TEST_TYPE.toUpperCase()} TEST for Rockets API`);
}

// Get a random rocket ID from the imported list
const randomRocketId = rocketIds.rocket_ids[Math.floor(Math.random() * rocketIds.rocket_ids.length)];

const response = http.get(`https://api.spacexdata.com/v4/rockets/${randomRocketId}`);

console.log(`=== DEBUG INFO ===`);
console.log(`Testing Rocket ID: ${randomRocketId}`);
console.log(`Status : ${response.status_text}`);
console.log(`URL: ${response.url}`);
console.log(`Body length: ${response.body ? response.body.length : 'null'}`);
console.log(`Body preview: ${response.body ? response.body.substring(0, 100) : 'null'}...`);
console.log(`==================`);

check(response, {
'status is 200': (r) => r.status === 200,
'request actually succeeded': (r) => {
if (r.status !== 200) return false;
if (!r.body || r.body === null || r.body.trim() === '') return false;
try {
const body = JSON.parse(r.body);
// For individual rocket, expect a single object with id
return body && body.id && typeof body.id === 'string';
} catch (e) {
return false;
}
},
'response time < 500ms': (r) => r.timings.duration < 500,
'has valid rocket data': (r) => {
try {
if (!r.body || r.body === null || r.body.trim() === '') return false;
const body = JSON.parse(r.body);

// Check that rocket has required fields
return body && body.id && typeof body.id === 'string' &&
body.name && typeof body.name === 'string' &&
body.height && body.mass; // Rocket-specific fields
} catch (e) {
return false;
}
},
'no business logic failure': (r) => {
// This should FAIL if we get 200 + empty body (business failure)
return !(r.status === 200 && (!r.body || r.body === null || r.body.trim() === ''));
},
});

if (response.status === 200 && (!response.body || response.body === null || response.body.trim() === '')) {
console.log(`BUSINESS FAILURE: Status 200 but empty body - this is a failed request!`);
} else if (response.status !== 200) {
console.log(`HTTP FAILURE: Status ${response.status} - ${response.status_text}`);
} else {
console.log(`SUCCESS: Status 200 with valid data`);
}

sleep(1);
}

export function handleSummary(data) {
return {
'reports/GetRocket.html': htmlReport(data),
};
}