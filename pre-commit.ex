#!/bin/bash

if [[ `git symbolic-ref HEAD` == "refs/heads/master" ]]
then
    echo "You cannot commit in master!"
    exit 1
fi

# TODO to not allow push and even merge/rebase on master/dev
# if this is a fork?
