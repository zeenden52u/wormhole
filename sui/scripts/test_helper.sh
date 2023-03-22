#!/bin/bash -f

echo "Running deploy script...\n"
./deploy.sh

echo "Copying env.sh file...\n"
cp ../../env.sh .

echo "Calling get_new_emitter.sh...\n"
./get_new_emitter.sh 

#echo "Calling publish_message.sh...\n"
#./publish_message.sh 
