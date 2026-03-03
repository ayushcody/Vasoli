const fs = require('fs');

const files = [
  'src/app/api/goals/route.ts',
  'src/app/api/health-score/route.ts',
  'src/app/api/recurring/upcoming/route.ts',
  'src/app/api/reminders/route.ts',
  'src/app/api/transactions/route.ts',
  'src/app/api/transactions/summary/route.ts'
];

files.forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    
    // Replace next-auth imports natively based on string search
    const importStr1 = 'import { getServerSession } from "next-auth";';
    const importReplace1 = 'import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";\nimport { cookies } from "next/headers";';
    content = content.replace(importStr1, importReplace1);
    
    const importStr2 = 'import { authOptions } from "../auth/[...nextauth]/route";';
    content = content.replace(importStr2, '');
    const importStr3 = 'import { authOptions } from "../../auth/[...nextauth]/route";';
    content = content.replace(importStr3, '');
    
    // Replace session logic safely
    content = content.replace(/const session = await getServerSession\(authOptions\);/g, 'const cookieStore = cookies();\n    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });\n    const { data: { user } } = await supabase.auth.getUser();');
    
    // Replace user checks gracefully
    content = content.replace(/!session\?\.user\?\.id/g, '!user?.id');
    content = content.replace(/\(session\.user as any\)\.id/g, 'user.id');
    
    fs.writeFileSync(file, content);
    console.log(`Updated ${file}`);
  }
});
