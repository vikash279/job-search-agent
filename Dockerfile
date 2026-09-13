FROM node:20-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma ./prisma
COPY src ./src
COPY tsconfig.json ./
RUN npx prisma generate
ENV NODE_ENV=production
EXPOSE 4000
CMD ["npm", "start"]
