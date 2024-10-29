This is a single-use script that I created to swap the width and height of images in one particular imageset. These dimensions were swapped
due to a bug in handling of an absent Orientation tag that was fixed in commit 930e3f4da22f73a5206602cfa7f63ac2ef7ede6d.

However, the allready imported images were still stored incorrectly and I didn't want to do a full re-import just to fix something so trivial.
So I decided to write a little nodejs script that would swap the width and height for me.

This turned into a terrible battle as the amplify provided graphql client does not properly support IAM authorization, I didn't have API key auth activated on the relevant tables and I didn't want to mess with the production backend for this. So I ended up writing a signed fetch script that I could run locally. (The full re-import would probably have been faster :-())

As mentioned before, this is a single-use script. It has many shortcomings that I would fix if I thought it would ever be used again, but I am commiting it to the repo just so that there is an example of how to do auth from a script (where we can't use cognito) if we need to do something similar in future. 
