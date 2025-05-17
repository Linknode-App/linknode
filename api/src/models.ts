export interface TweetInput {
  text: string;
  timestamp: number; // Only Unix timestamp in input
}

export interface Tweet {
  text: string;
  timestamp: number; // always Unix timestamp in output
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
   * Optional: Current timezone of the user or audience (e.g., 'America/New_York')
   */
  current_timezone?: string;
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