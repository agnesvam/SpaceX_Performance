FROM grafana/k6:latest

# Set working directory
WORKDIR /app

# Copy all test files
COPY . .

# Create reports directory
RUN mkdir -p reports

# Default command (can be overridden)
CMD ["k6", "run", "rockets/GetRocket.js"]
