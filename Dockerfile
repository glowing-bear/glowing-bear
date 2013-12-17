#
# Dockerfile for glowing-bear
#
# Will install required dependencies for bulding the project and serve it over HTTP using a simple python web server
#
# VERSION   0.0.1


FROM ubuntu:12.04
MAINTAINER Tor Hveem <tor@hveem.no>
ENV REFRESHED_AT 2013-12-17

RUN echo "deb-src http://archive.ubuntu.com/ubuntu precise main" >> /etc/apt/sources.list
RUN sed 's/main$/main universe/' -i /etc/apt/sources.list
RUN apt-get update
RUN apt-get upgrade -y


RUN    apt-get -y install python-software-properties software-properties-common vim git

# Bower and LESS compiler
RUN    add-apt-repository -y ppa:chris-lea/node.js
RUN    apt-get update
RUN    apt-get install -y nodejs 
RUN    npm install less -g
RUN    npm install bower -g

RUN    git clone https://github.com/cormier/glowing-bear

RUN    cd glowing-bear; bower --allow-root install

EXPOSE 8000
CMD cd glowing-bear; python -m SimpleHTTPServer



