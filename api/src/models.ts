export interface TweetInput {
  text: string;
  /**
   * Optional: ISO 8601 string timestamp. If not provided, the system will use a default or current time.
   */
  timestamp?: string;
}

export interface Tweet {
  text: string;
  timestamp: string; // ISO 8601 string in output
  readable_time?: string;
}

export interface ScheduleRequest {
  context: string;
  tweets: TweetInput[];
  /**
   * Optional: Preferred posting frequency (e.g., 'daily', 'weekly', 'hourly')
   */
  preferred_frequency?: string;
  /**
   * Optional: Maximum number of posts allowed per day
   */
  max_posts_per_day?: number;
  /**
   * Optional: Current time in ISO 8601 format (e.g., for scheduling reference)
   */
  current_time?: string;
  /**
   * Optional: Current timezone of the user or system (e.g., 'America/New_York')
   */
  current_timezone?: string;
  /**
   * Optional: Target audience timezone (e.g., 'Europe/Paris')
   */
  audience_timezone?: string;
  /**
   * Optional: Whether translation is needed for the tweets
   */
  is_translation_needed?: boolean;
  /**
   * Optional: Target language for translation (e.g., 'es', 'fr')
   */
  language_to_translate?: string;
  /**
   * Optional: Array of historical tweets for context (text and timestamp)
   */
  historical_tweets?: TweetInput[];
}

export interface ScheduleResponse {
  tweets: Tweet[];
} 