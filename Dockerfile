FROM node:20-alpine

# Install Java (required for JS2PDFInjector) and Git (for cloning submodule if missing)
RUN apk add --no-cache openjdk17-jre git

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Check if submodule is present; if not, clone it
RUN if [ ! -f ./JS2PDFInjector/JS2PDFInjector-1.0.jar ]; then \
    echo "Submodule missing. Cloning from remote..."; \
    git clone https://github.com/renebohne/JS2PDFInjector.git temp_submodule && \
    cp -r temp_submodule/* JS2PDFInjector/ && \
    rm -rf temp_submodule; \
    fi

# Ensure the script is executable
RUN chmod +x your-script.sh

EXPOSE 3000

CMD ["node", "server.js"]
