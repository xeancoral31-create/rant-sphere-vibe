const fs = require('fs');
let c = fs.readFileSync('src/routes/_authenticated/friends.tsx', 'utf8');

c = c.replace(/<div className="bg-card p-6 flex flex-col items-center justify-center text-center border-b">[\s\S]*?Friend system<\/p>[\s\S]*?<\/div>/, `<div>
            <h1 className="font-display text-2xl font-bold bg-gradient-to-r from-primary to-pink-400 bg-clip-text text-transparent">
              Friends & Groups
            </h1>
            <p className="text-sm text-muted-foreground">Friend system</p>
          </div>`);

fs.writeFileSync('src/routes/_authenticated/friends.tsx', c);
