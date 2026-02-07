import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  Search,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Key,
  Shield,
  AlertTriangle,
  CheckCircle2,
  ListOrdered,
  Info,
  Copy,
} from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { PLATFORM_DISPLAY_NAMES, PLATFORM_ICON_COLORS } from '@/lib/constants';
import { Platform } from '@ai-poster/shared';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AuthType = 'OAuth' | 'API Key' | 'App Password';
type Difficulty = 'Easy' | 'Medium' | 'Advanced';

interface PlatformGuide {
  platform: Platform;
  authType: AuthType;
  difficulty: Difficulty;
  portalUrl: string;
  portalName: string;
  prerequisites: string[];
  steps: string[];
  credentials: { field: string; description: string }[];
  scopes: string[];
  notes: string[];
}

// ---------------------------------------------------------------------------
// Platform guide data
// ---------------------------------------------------------------------------

const PLATFORM_GUIDES: PlatformGuide[] = [
  {
    platform: Platform.TWITTER,
    authType: 'OAuth',
    difficulty: 'Medium',
    portalUrl: 'https://developer.twitter.com/en/portal/dashboard',
    portalName: 'Twitter Developer Portal',
    prerequisites: [
      'A Twitter / X account in good standing',
      'A verified phone number on the account',
      'Developer account approval (free tier available)',
    ],
    steps: [
      'Go to the Twitter Developer Portal at `https://developer.twitter.com/en/portal/dashboard`.',
      'Click **Projects & Apps** in the sidebar, then **+ New Project**.',
      'Give the project a name, select a use case, and provide a description.',
      'Inside the project, click **+ Add App** and choose a production environment.',
      'Navigate to the App settings and open the **Keys and tokens** tab.',
      'Under **User authentication settings**, click **Set up** and select **OAuth 2.0**.',
      'Set the App type to **Web App, Automated App or Bot**.',
      'Enter your **Redirect URI** (callback URL from the Settings page) and a **Website URL**.',
      'Save the settings and copy the **Client ID** and **Client Secret**.',
    ],
    credentials: [
      { field: 'Client ID', description: 'The OAuth 2.0 Client ID displayed after setting up user authentication.' },
      { field: 'Client Secret', description: 'The OAuth 2.0 Client Secret generated alongside the Client ID.' },
    ],
    scopes: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'],
    notes: [
      'Elevated access may be required for higher rate limits and additional endpoints.',
      'Free-tier accounts are limited to 1,500 tweets per month.',
      'The OAuth 2.0 callback URL must exactly match the URL configured in this application.',
      'Store the Client Secret securely -- it is only shown once.',
    ],
  },
  {
    platform: Platform.LINKEDIN,
    authType: 'OAuth',
    difficulty: 'Medium',
    portalUrl: 'https://www.linkedin.com/developers/apps',
    portalName: 'LinkedIn Developer Portal',
    prerequisites: [
      'A LinkedIn account',
      'A LinkedIn Company Page (required to create an app)',
      'Admin or developer role on the Company Page',
    ],
    steps: [
      'Go to the LinkedIn Developer Portal at `https://www.linkedin.com/developers/apps`.',
      'Click **Create App** and fill in the app name, Company Page, logo, and privacy policy URL.',
      'After creation, open the **Auth** tab to find your credentials.',
      'Add your **Redirect URL** (callback URL from the Settings page) under OAuth 2.0 settings.',
      'Go to the **Products** tab and request access to **Sign In with LinkedIn using OpenID Connect**.',
      'Also request **Share on LinkedIn** to enable posting capabilities.',
      'Wait for product approval (usually instant for Sign In, may take a few minutes for Share).',
      'Copy the **Client ID** and **Client Secret** from the Auth tab.',
    ],
    credentials: [
      { field: 'Client ID', description: 'Found on the Auth tab of your LinkedIn app.' },
      { field: 'Client Secret', description: 'Found on the Auth tab -- click the eye icon to reveal.' },
    ],
    scopes: ['openid', 'profile', 'w_member_social'],
    notes: [
      'The Company Page admin must verify the app before it can access company data.',
      'LinkedIn API rate limits are generally 100 requests per day per member for most endpoints.',
      'Ensure the redirect URL matches exactly, including trailing slashes.',
    ],
  },
  {
    platform: Platform.LINKEDIN_PAGE,
    authType: 'OAuth',
    difficulty: 'Advanced',
    portalUrl: 'https://www.linkedin.com/developers/apps',
    portalName: 'LinkedIn Developer Portal',
    prerequisites: [
      'A LinkedIn account with admin access to a Company Page',
      'An existing LinkedIn Developer App (or create a new one)',
      'Company Page verification completed',
    ],
    steps: [
      'Go to the LinkedIn Developer Portal at `https://www.linkedin.com/developers/apps`.',
      'Open your existing app (or create one following the LinkedIn Personal guide).',
      'Navigate to the **Products** tab.',
      'Request access to **Marketing Developer Platform** -- this is required for page-level posting.',
      'Fill out the request form with your use case and company information.',
      'Wait for approval (can take 1-5 business days for Marketing Developer Platform).',
      'Once approved, go to the **Auth** tab and verify the new scopes are listed.',
      'Copy the **Client ID** and **Client Secret**.',
      'Note down your **Organization ID** -- find it by visiting your Company Page and looking at the URL: `linkedin.com/company/ORGANIZATION_ID/`.',
    ],
    credentials: [
      { field: 'Client ID', description: 'Found on the Auth tab of your LinkedIn app.' },
      { field: 'Client Secret', description: 'Found on the Auth tab -- click the eye icon to reveal.' },
      { field: 'Organization ID', description: 'The numeric ID from your Company Page URL.' },
    ],
    scopes: ['openid', 'profile', 'w_member_social', 'w_organization_social', 'r_organization_social'],
    notes: [
      'Marketing Developer Platform approval is required and may take several business days.',
      'The Organization ID must belong to a page where your app admin has page admin access.',
      'Rate limits for organization posts are stricter than personal posts (100 per day per organization).',
      'Business verification may be required for production access.',
    ],
  },
  {
    platform: Platform.FACEBOOK,
    authType: 'OAuth',
    difficulty: 'Advanced',
    portalUrl: 'https://developers.facebook.com/apps/',
    portalName: 'Meta Developer Portal',
    prerequisites: [
      'A Facebook account',
      'A Facebook Page you administer',
      'Meta Developer account (register at developers.facebook.com)',
    ],
    steps: [
      'Go to the Meta Developer Portal at `https://developers.facebook.com/apps/`.',
      'Click **Create App** and select the **Business** app type.',
      'Enter an app name, contact email, and optionally link a Business portfolio.',
      'After creation, go to **App Settings > Basic** to find your App ID and App Secret.',
      'In the left sidebar, click **Add Product** and find **Facebook Login** -- click **Set Up**.',
      'Choose **Web** as the platform and enter your site URL.',
      'Go to **Facebook Login > Settings** and add your **Redirect URI** (OAuth callback URL).',
      'Under **Permissions and Features**, request `pages_manage_posts` and `pages_read_engagement`.',
      'Copy the **App ID** and **App Secret** from App Settings > Basic.',
    ],
    credentials: [
      { field: 'App ID', description: 'Found in App Settings > Basic at the top of the page.' },
      { field: 'App Secret', description: 'Found in App Settings > Basic -- click Show to reveal.' },
    ],
    scopes: ['pages_manage_posts', 'pages_read_engagement', 'pages_show_list'],
    notes: [
      'Business verification may be required before your app can go live.',
      'Apps start in Development mode -- only test users and app admins can authenticate.',
      'To go live, submit the app for App Review with each permission explained.',
      'Rate limits: 200 calls per hour per user for most Graph API endpoints.',
      'Page access tokens are long-lived but should be refreshed periodically.',
    ],
  },
  {
    platform: Platform.INSTAGRAM,
    authType: 'OAuth',
    difficulty: 'Advanced',
    portalUrl: 'https://developers.facebook.com/apps/',
    portalName: 'Meta Developer Portal',
    prerequisites: [
      'An Instagram Professional or Business account (not a personal account)',
      'The Instagram account must be linked to a Facebook Page',
      'A Meta Developer app (can reuse your Facebook app)',
    ],
    steps: [
      'Go to the Meta Developer Portal at `https://developers.facebook.com/apps/`.',
      'Open your existing app (or create one -- see the Facebook guide above).',
      'In the left sidebar, click **Add Product** and find **Instagram Graph API** -- click **Set Up**.',
      'Go to **Instagram Graph API > Basic Display** and configure the settings.',
      'Add your **Redirect URI** (OAuth callback URL) under Valid OAuth Redirect URIs.',
      'Under **Permissions and Features**, request `instagram_basic`, `instagram_content_publish`, and `pages_show_list`.',
      'In your Instagram app, go to Settings > Account > Linked Accounts and ensure the Facebook Page is linked.',
      'Copy the **App ID** and **App Secret** from App Settings > Basic.',
    ],
    credentials: [
      { field: 'App ID', description: 'Same as your Meta / Facebook App ID from App Settings > Basic.' },
      { field: 'App Secret', description: 'Same as your Meta / Facebook App Secret.' },
    ],
    scopes: [
      'instagram_basic',
      'instagram_content_publish',
      'pages_show_list',
      'pages_read_engagement',
    ],
    notes: [
      'Only Professional/Business Instagram accounts are supported -- personal accounts cannot use the Graph API.',
      'The Instagram account MUST be linked to a Facebook Page.',
      'Content publishing is limited to 25 posts per 24-hour period.',
      'Image requirements: JPEG format, maximum 8MB, aspect ratio between 4:5 and 1.91:1.',
      'App Review is required for production access with each permission justified.',
    ],
  },
  {
    platform: Platform.YOUTUBE,
    authType: 'OAuth',
    difficulty: 'Advanced',
    portalUrl: 'https://console.cloud.google.com/',
    portalName: 'Google Cloud Console',
    prerequisites: [
      'A Google account',
      'A YouTube channel linked to the Google account',
      'Google Cloud project (free tier available)',
    ],
    steps: [
      'Go to the Google Cloud Console at `https://console.cloud.google.com/`.',
      'Create a new project or select an existing one from the project dropdown.',
      'Navigate to **APIs & Services > Library**.',
      'Search for **YouTube Data API v3** and click **Enable**.',
      'Go to **APIs & Services > OAuth consent screen** and configure it (External user type for testing).',
      'Add the required scopes: `youtube.upload`, `youtube.readonly`, and `youtube.force-ssl`.',
      'Add test users if the app is in testing mode.',
      'Go to **APIs & Services > Credentials** and click **+ Create Credentials > OAuth client ID**.',
      'Select **Web application**, give it a name, and add your **Redirect URI** under Authorized redirect URIs.',
      'Copy the **Client ID** and **Client Secret** from the created credential.',
    ],
    credentials: [
      { field: 'Client ID', description: 'The OAuth 2.0 Client ID from the Credentials page.' },
      { field: 'Client Secret', description: 'The OAuth 2.0 Client Secret from the Credentials page.' },
    ],
    scopes: [
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube.readonly',
      'https://www.googleapis.com/auth/youtube.force-ssl',
    ],
    notes: [
      'Apps in "Testing" mode are limited to 100 test users and tokens expire every 7 days.',
      'To go to production, you must submit for Google OAuth verification (can take weeks).',
      'YouTube API quota: 10,000 units per day by default. A video upload costs ~1,600 units.',
      'Community posts and Shorts are available via separate API endpoints.',
      'Sensitive scopes require a privacy policy URL and may require a security audit.',
    ],
  },
  {
    platform: Platform.TIKTOK,
    authType: 'OAuth',
    difficulty: 'Advanced',
    portalUrl: 'https://developers.tiktok.com/',
    portalName: 'TikTok Developer Portal',
    prerequisites: [
      'A TikTok account',
      'TikTok Developer account (register at developers.tiktok.com)',
      'Agreement to TikTok Developer Terms of Service',
    ],
    steps: [
      'Go to the TikTok Developer Portal at `https://developers.tiktok.com/`.',
      'Click **Manage apps** in the top navigation, then **Connect an app**.',
      'Fill in the app name, description, icon, and category.',
      'Under **Add products**, select **Content Posting API** (and optionally Login Kit).',
      'Configure the **Redirect URI** (OAuth callback URL from the Settings page).',
      'In the app configuration, add the required scopes for content posting.',
      'Submit the app for review -- provide a detailed description of your use case.',
      'Once approved, find your **Client Key** and **Client Secret** on the app details page.',
    ],
    credentials: [
      { field: 'Client Key', description: 'Listed as Client Key on your TikTok app dashboard.' },
      { field: 'Client Secret', description: 'Listed as Client Secret -- click to reveal.' },
    ],
    scopes: ['user.info.basic', 'video.publish', 'video.upload'],
    notes: [
      'App review is mandatory before any users besides the developer can authenticate.',
      'Review typically takes 1-3 business days.',
      'Content Posting API supports video uploads only (no photo posts via API currently).',
      'Rate limits vary by endpoint -- video publish is limited to 3 uploads per day per user during sandbox.',
      'Videos must comply with TikTok Community Guidelines.',
    ],
  },
  {
    platform: Platform.REDDIT,
    authType: 'OAuth',
    difficulty: 'Easy',
    portalUrl: 'https://www.reddit.com/prefs/apps',
    portalName: 'Reddit App Preferences',
    prerequisites: [
      'A Reddit account (email verified)',
      'Sufficient account age and karma may be needed for some subreddits',
    ],
    steps: [
      'Go to Reddit App Preferences at `https://www.reddit.com/prefs/apps`.',
      'Scroll to the bottom and click **create another app...**',
      'Enter a name for your application.',
      'Select **web app** as the app type.',
      'Enter a brief description.',
      'Set the **redirect uri** to your OAuth callback URL from the Settings page.',
      'Click **create app**.',
      'Copy the **Client ID** (shown below the app name) and the **Client Secret**.',
    ],
    credentials: [
      { field: 'Client ID', description: 'The string shown directly under the app name (looks like a random string).' },
      { field: 'Client Secret', description: 'Labeled as "secret" on the app details page.' },
    ],
    scopes: ['submit', 'read', 'identity', 'edit'],
    notes: [
      'Rate limit: 60 requests per minute when using OAuth.',
      'Reddit requires a unique User-Agent string for API requests.',
      'Posts to certain subreddits may require minimum karma or account age.',
      'Self-posts (text) and link posts are supported -- image/video posts require media upload first.',
      'The redirect URI must match exactly (no trailing slashes unless configured).',
    ],
  },
  {
    platform: Platform.PINTEREST,
    authType: 'OAuth',
    difficulty: 'Medium',
    portalUrl: 'https://developers.pinterest.com/apps/',
    portalName: 'Pinterest Developer Portal',
    prerequisites: [
      'A Pinterest Business account (or convert a personal account)',
      'Pinterest Developer access (register at developers.pinterest.com)',
    ],
    steps: [
      'Go to the Pinterest Developer Portal at `https://developers.pinterest.com/apps/`.',
      'Click **Create app** (or **Connect app** if prompted).',
      'Fill in the app name, description, and website URL.',
      'After creation, go to the app dashboard.',
      'Add your **Redirect URI** (OAuth callback URL) under the OAuth settings.',
      'Request the required scopes: `boards:read`, `pins:read`, `pins:write`.',
      'Copy the **App ID** and **App Secret** from the app dashboard.',
    ],
    credentials: [
      { field: 'App ID', description: 'Listed as App ID on the app dashboard.' },
      { field: 'App Secret', description: 'Listed as App Secret -- click to reveal.' },
    ],
    scopes: ['boards:read', 'pins:read', 'pins:write', 'user_accounts:read'],
    notes: [
      'Trial access is available immediately with limited rate limits.',
      'Production access requires app review and approval by Pinterest.',
      'Trial mode limits: 10 calls per minute, 200 calls per hour.',
      'Pin creation requires an image URL or image upload.',
      'Only Business accounts can use the Pinterest API for posting.',
    ],
  },
  {
    platform: Platform.THREADS,
    authType: 'OAuth',
    difficulty: 'Advanced',
    portalUrl: 'https://developers.facebook.com/apps/',
    portalName: 'Meta Developer Portal',
    prerequisites: [
      'An Instagram account (Threads uses Instagram credentials)',
      'A Threads profile activated from the Instagram account',
      'A Meta Developer app (can reuse your Facebook/Instagram app)',
    ],
    steps: [
      'Go to the Meta Developer Portal at `https://developers.facebook.com/apps/`.',
      'Open your existing Meta app or create a new one (Business type).',
      'In the left sidebar, click **Add Product** and find **Threads API** -- click **Set Up**.',
      'Configure the **Redirect URI** (OAuth callback URL) in the Threads API settings.',
      'Under **Permissions and Features**, request `threads_basic` and `threads_content_publish`.',
      'Add test users in the Roles section if your app is in development mode.',
      'Copy the **App ID** and **App Secret** from App Settings > Basic.',
    ],
    credentials: [
      { field: 'App ID', description: 'Same as your Meta App ID from App Settings > Basic.' },
      { field: 'App Secret', description: 'Same as your Meta App Secret from App Settings > Basic.' },
    ],
    scopes: ['threads_basic', 'threads_content_publish', 'threads_manage_replies'],
    notes: [
      'Threads API uses the same Meta app as Facebook and Instagram.',
      'The API is relatively new -- some features may change.',
      'Publishing limit: 250 posts per 24-hour period.',
      'Text posts can be up to 500 characters.',
      'Image posts require JPEG or PNG, maximum 5MB.',
      'App Review is required for production access.',
    ],
  },
  {
    platform: Platform.DISCORD,
    authType: 'API Key',
    difficulty: 'Easy',
    portalUrl: 'https://discord.com/developers/applications',
    portalName: 'Discord Developer Portal',
    prerequisites: [
      'A Discord account',
      'A Discord server where you have administrative permissions',
    ],
    steps: [
      'Go to the Discord Developer Portal at `https://discord.com/developers/applications`.',
      'Click **New Application** and give it a name.',
      'In the left sidebar, click **Bot**.',
      'Click **Add Bot** and confirm.',
      'Under the bot section, click **Reset Token** to generate a new bot token -- copy it immediately.',
      'Enable the necessary **Privileged Gateway Intents** if needed (Message Content Intent for reading messages).',
      'Go to **OAuth2 > URL Generator**, select the `bot` scope and the `Send Messages` permission.',
      'Copy the generated URL and open it in a browser to add the bot to your server.',
      'Note down the **Application ID** from the General Information page.',
    ],
    credentials: [
      { field: 'Bot Token', description: 'The token generated in the Bot section -- only shown once after reset.' },
      { field: 'Application ID', description: 'Found on the General Information page of your application.' },
    ],
    scopes: ['bot', 'Send Messages', 'Embed Links', 'Attach Files'],
    notes: [
      'Bot tokens are shown only once -- save them immediately.',
      'The bot must be invited to each server where you want to post.',
      'Rate limit: 50 requests per second globally, 5 messages per 5 seconds per channel.',
      'Bots can only post in channels where they have Send Messages permission.',
      'Use channel IDs (right-click channel > Copy ID with Developer Mode enabled) to target specific channels.',
    ],
  },
  {
    platform: Platform.SLACK,
    authType: 'OAuth',
    difficulty: 'Easy',
    portalUrl: 'https://api.slack.com/apps',
    portalName: 'Slack API Portal',
    prerequisites: [
      'A Slack workspace where you have admin permissions',
      'A Slack account in that workspace',
    ],
    steps: [
      'Go to the Slack API Portal at `https://api.slack.com/apps`.',
      'Click **Create New App** and choose **From scratch**.',
      'Enter an app name and select the workspace.',
      'In the left sidebar, click **OAuth & Permissions**.',
      'Under **Bot Token Scopes**, add: `chat:write`, `channels:read`, and `groups:read`.',
      'Scroll up and click **Install to Workspace**, then **Allow**.',
      'Copy the **Bot User OAuth Token** (starts with `xoxb-`).',
      'Go to **Basic Information** and copy the **Signing Secret**.',
      'In your Slack workspace, invite the bot to the desired channel(s) by typing `/invite @YourBotName`.',
    ],
    credentials: [
      { field: 'Bot Token', description: 'The Bot User OAuth Token starting with xoxb- from OAuth & Permissions.' },
      { field: 'Signing Secret', description: 'Found in Basic Information under App Credentials.' },
    ],
    scopes: ['chat:write', 'channels:read', 'groups:read', 'chat:write.public'],
    notes: [
      'The bot must be invited to each channel before it can post there.',
      'Rate limit: approximately 1 message per second per channel (Tier 2).',
      'Use `chat:write.public` scope to post to channels without being a member.',
      'Message formatting uses Slack\'s Block Kit or mrkdwn syntax, not standard Markdown.',
      'File uploads use a separate API endpoint with its own rate limits.',
    ],
  },
  {
    platform: Platform.MASTODON,
    authType: 'API Key',
    difficulty: 'Easy',
    portalUrl: 'https://mastodon.social/settings/applications',
    portalName: 'Instance Settings (varies by instance)',
    prerequisites: [
      'A Mastodon account on any instance (e.g., mastodon.social, hachyderm.io)',
      'Access to the Development settings on your instance',
    ],
    steps: [
      'Log in to your Mastodon instance (e.g., `https://mastodon.social`).',
      'Go to **Preferences > Development** (URL: `https://YOUR_INSTANCE/settings/applications`).',
      'Click **New Application**.',
      'Enter an application name and optionally a website URL.',
      'Under **Scopes**, check at minimum: `read`, `write`, and `follow`.',
      'Click **Submit** to create the application.',
      'Click on the newly created application to view its details.',
      'Copy the **Access Token** (this is your API token for posting).',
    ],
    credentials: [
      { field: 'Instance URL', description: 'The full URL of your Mastodon instance (e.g., https://mastodon.social).' },
      { field: 'Access Token', description: 'Found on the application detail page after creation.' },
    ],
    scopes: ['read', 'write', 'follow'],
    notes: [
      'Each Mastodon instance is independently operated -- settings may differ between instances.',
      'The Access Token is instance-specific and works only for that instance.',
      'Post character limit varies by instance (typically 500 characters on mastodon.social).',
      'Media attachments: up to 4 images, or 1 video, or 1 audio file per post.',
      'No app review process -- tokens are available immediately.',
      'Rate limit: 300 requests per 5 minutes per access token.',
    ],
  },
  {
    platform: Platform.BLUESKY,
    authType: 'App Password',
    difficulty: 'Easy',
    portalUrl: 'https://bsky.app/settings/app-passwords',
    portalName: 'Bluesky Settings',
    prerequisites: [
      'A Bluesky account (bsky.social or custom PDS)',
      'Access to the account settings',
    ],
    steps: [
      'Log in to Bluesky at `https://bsky.app`.',
      'Click on your profile icon and go to **Settings**.',
      'Select **App Passwords** from the settings menu (or go directly to `https://bsky.app/settings/app-passwords`).',
      'Click **Add App Password**.',
      'Give the app password a descriptive name (e.g., "Postiz Integration").',
      'Copy the generated **App Password** immediately -- it will not be shown again.',
      'Note your **Handle** (e.g., `yourname.bsky.social`).',
    ],
    credentials: [
      { field: 'Handle', description: 'Your Bluesky handle (e.g., yourname.bsky.social or custom domain).' },
      { field: 'App Password', description: 'The generated app-specific password (not your main account password).' },
    ],
    scopes: ['Full account access via AT Protocol (app passwords have the same permissions as your account)'],
    notes: [
      'Bluesky uses the AT Protocol -- there is no traditional OAuth flow.',
      'App passwords provide full account access, so keep them secure.',
      'You can revoke an app password at any time from Settings without affecting your main password.',
      'Post character limit: 300 characters (graphemes).',
      'Image attachments: up to 4 images per post, max 1MB each.',
      'Rate limits: 1,666 points per hour, 35,000 points per day (creating a post costs 3 points).',
    ],
  },
  {
    platform: Platform.DRIBBBLE,
    authType: 'OAuth',
    difficulty: 'Medium',
    portalUrl: 'https://dribbble.com/account/applications',
    portalName: 'Dribbble Developer Portal',
    prerequisites: [
      'A Dribbble account (Pro account may be required for API access)',
      'A portfolio with at least one published shot',
    ],
    steps: [
      'Go to Dribbble Applications at `https://dribbble.com/account/applications`.',
      'Click **Register a New Application**.',
      'Fill in the application name, description, and website URL.',
      'Enter your **Redirect URI** (OAuth callback URL from the Settings page).',
      'Agree to the Dribbble API Terms of Service.',
      'Click **Register Application**.',
      'Copy the **Client ID** and **Client Secret** from the application details page.',
    ],
    credentials: [
      { field: 'Client ID', description: 'Displayed on the application details page after registration.' },
      { field: 'Client Secret', description: 'Displayed alongside the Client ID on the application page.' },
    ],
    scopes: ['public', 'upload'],
    notes: [
      'A Pro account may be required for full API access and uploading shots.',
      'Rate limit: 60 requests per minute for authenticated requests.',
      'Shots (posts) require an image upload -- text-only posts are not supported.',
      'The API primarily supports shots, projects, and user profiles.',
      'API access may be limited or deprecated -- check Dribbble\'s current developer documentation.',
    ],
  },
];

// ---------------------------------------------------------------------------
// Helper lookups
// ---------------------------------------------------------------------------

const AUTH_TYPE_BADGE_VARIANT: Record<AuthType, 'scheduled' | 'generated' | 'pending'> = {
  'OAuth': 'scheduled',
  'API Key': 'generated',
  'App Password': 'pending',
};

const DIFFICULTY_BADGE_VARIANT: Record<Difficulty, 'approved' | 'generated' | 'failed'> = {
  Easy: 'approved',
  Medium: 'generated',
  Advanced: 'failed',
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PlatformIcon({ platform }: { platform: Platform }) {
  return (
    <div
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
      style={{ backgroundColor: PLATFORM_ICON_COLORS[platform] }}
    >
      {platform.slice(0, 2)}
    </div>
  );
}

function SectionHeading({
  icon,
  title,
}: {
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
      {icon}
      {title}
    </div>
  );
}

function CodeInline({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-surface-tertiary px-1.5 py-0.5 text-xs font-mono text-text-primary">
      {children}
    </code>
  );
}

function renderStepText(text: string) {
  // Render inline markdown-like formatting: **bold**, `code`, and plain text
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*|`(.+?)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyIndex = 0;

  while ((match = regex.exec(text)) !== null) {
    // Text before the match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[2]) {
      // Bold
      parts.push(
        <strong key={keyIndex++} className="font-semibold">
          {match[2]}
        </strong>
      );
    } else if (match[3]) {
      // Code
      parts.push(<CodeInline key={keyIndex++}>{match[3]}</CodeInline>);
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

function ExpandedGuide({ guide }: { guide: PlatformGuide }) {
  return (
    <div className="mt-4 space-y-6 border-t border-gray-100 pt-5">
      {/* Portal link */}
      <div className="flex items-center gap-2">
        <ExternalLink className="h-4 w-4 text-text-muted" />
        <a
          href={guide.portalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-brand-600 hover:underline"
        >
          Open {guide.portalName}
        </a>
      </div>

      {/* Prerequisites */}
      <div className="space-y-2">
        <SectionHeading
          icon={<CheckCircle2 className="h-4 w-4 text-green-600" />}
          title="Prerequisites"
        />
        <ul className="ml-6 list-disc space-y-1">
          {guide.prerequisites.map((item, i) => (
            <li key={i} className="text-sm text-text-muted">
              {renderStepText(item)}
            </li>
          ))}
        </ul>
      </div>

      {/* Step-by-step instructions */}
      <div className="space-y-2">
        <SectionHeading
          icon={<ListOrdered className="h-4 w-4 text-brand-600" />}
          title="Step-by-Step Instructions"
        />
        <ol className="ml-6 list-decimal space-y-2">
          {guide.steps.map((step, i) => (
            <li key={i} className="text-sm text-text-muted leading-relaxed">
              {renderStepText(step)}
            </li>
          ))}
        </ol>
      </div>

      {/* Required credentials */}
      <div className="space-y-2">
        <SectionHeading
          icon={<Key className="h-4 w-4 text-amber-600" />}
          title="Required Credentials"
        />
        <div className="space-y-2">
          {guide.credentials.map((cred, i) => (
            <div
              key={i}
              className="flex items-start gap-3 rounded-lg border border-gray-100 bg-surface-tertiary p-3"
            >
              <Copy className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-muted" />
              <div>
                <p className="text-sm font-medium text-text-primary">
                  {cred.field}
                </p>
                <p className="mt-0.5 text-xs text-text-muted">
                  {renderStepText(cred.description)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Scopes / Permissions */}
      <div className="space-y-2">
        <SectionHeading
          icon={<Shield className="h-4 w-4 text-purple-600" />}
          title="Scopes / Permissions Needed"
        />
        <div className="flex flex-wrap gap-1.5">
          {guide.scopes.map((scope, i) => (
            <span
              key={i}
              className="inline-flex items-center rounded-md bg-surface-tertiary px-2 py-1 text-xs font-mono text-text-primary"
            >
              {scope}
            </span>
          ))}
        </div>
      </div>

      {/* Important notes */}
      <div className="space-y-2">
        <SectionHeading
          icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}
          title="Important Notes"
        />
        <div className="rounded-lg border border-amber-100 bg-amber-50/50 p-3">
          <ul className="ml-4 list-disc space-y-1.5">
            {guide.notes.map((note, i) => (
              <li key={i} className="text-sm text-amber-900/80">
                {renderStepText(note)}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export function IntegrationGuidePage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedPlatform, setExpandedPlatform] = useState<Platform | null>(null);

  const filteredGuides = useMemo(() => {
    if (!searchQuery.trim()) return PLATFORM_GUIDES;
    const query = searchQuery.toLowerCase();
    return PLATFORM_GUIDES.filter((guide) => {
      const displayName = PLATFORM_DISPLAY_NAMES[guide.platform].toLowerCase();
      const platformKey = guide.platform.toLowerCase();
      return displayName.includes(query) || platformKey.includes(query);
    });
  }, [searchQuery]);

  const handleTogglePlatform = (platform: Platform) => {
    setExpandedPlatform((prev) => (prev === platform ? null : platform));
  };

  return (
    <div className="page-container space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          icon={<ArrowLeft className="h-4 w-4" />}
          onClick={() => navigate('/integrations')}
        >
          Back
        </Button>
        <div>
          <h2 className="section-title">Integration Setup Guides</h2>
          <p className="subtle-text mt-1">
            Step-by-step instructions to connect each social media platform.
          </p>
        </div>
      </div>

      {/* Search / Filter bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
        <input
          type="text"
          placeholder="Filter platforms by name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-lg border border-gray-100 bg-white py-2.5 pl-10 pr-4 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />
      </div>

      {/* Summary stats */}
      <div className="flex items-center gap-4 text-xs text-text-muted">
        <span className="flex items-center gap-1">
          <Info className="h-3.5 w-3.5" />
          {filteredGuides.length} platform{filteredGuides.length !== 1 ? 's' : ''} shown
        </span>
        <span className="text-gray-300">|</span>
        <span>Click any card to expand the setup guide</span>
      </div>

      {/* Platform guide cards */}
      {filteredGuides.length === 0 ? (
        <div className="rounded-xl border border-gray-100 bg-white px-6 py-12 text-center">
          <Search className="mx-auto mb-3 h-8 w-8 text-text-muted" />
          <p className="text-sm font-medium text-text-primary">No platforms found</p>
          <p className="mt-1 text-xs text-text-muted">
            Try a different search term.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredGuides.map((guide) => {
            const isExpanded = expandedPlatform === guide.platform;
            return (
              <Card key={guide.platform} className="transition-shadow">
                <CardBody>
                  {/* Collapsed row */}
                  <button
                    onClick={() => handleTogglePlatform(guide.platform)}
                    className="flex w-full items-center justify-between text-left"
                  >
                    <div className="flex items-center gap-3">
                      <PlatformIcon platform={guide.platform} />
                      <div>
                        <p className="font-medium text-text-primary">
                          {PLATFORM_DISPLAY_NAMES[guide.platform]}
                        </p>
                        <div className="mt-1 flex items-center gap-2">
                          <Badge variant={AUTH_TYPE_BADGE_VARIANT[guide.authType]}>
                            {guide.authType}
                          </Badge>
                          <Badge variant={DIFFICULTY_BADGE_VARIANT[guide.difficulty]}>
                            {guide.difficulty}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="hidden text-xs text-text-muted sm:inline">
                        {guide.steps.length} steps
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="h-5 w-5 text-text-muted" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-text-muted" />
                      )}
                    </div>
                  </button>

                  {/* Expanded guide */}
                  {isExpanded && <ExpandedGuide guide={guide} />}
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
