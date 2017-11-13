FROM node:alpine
ENV NODE_ENV dev
RUN mkdir -p /var/app
COPY . /var/app
RUN cd /var/app && npm update && \
        npm install --silent -g grunt && \
        npm install --silent && \
        npm run grunt
WORKDIR /var/app
ENV NODE_ENV=production
CMD ["npm", "start"]