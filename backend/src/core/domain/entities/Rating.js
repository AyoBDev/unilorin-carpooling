/**
 * Rating Entity - Represents ratings and feedback in the system
 * Domain Entity following DDD principles
 * University of Ilorin Carpooling Platform
 */

const { parseDate, isInRange } = require('./utils/entityHelpers');

class Rating {
  constructor({
    ratingId,
    bookingId,
    rideId,

    // Rater Information
    raterId, // User ID of person giving the rating
    raterType, // 'passenger' | 'driver'
    raterName,

    // Rated Entity Information
    ratedId, // User ID of person being rated
    ratedType, // 'passenger' | 'driver'
    ratedName,

    // Rating Scores (1-5 scale)
    overallRating,
    punctualityRating = null,
    communicationRating = null,
    vehicleConditionRating = null, // For driver ratings
    drivingSkillRating = null, // For driver ratings
    safetyRating = null,
    cleanlinessRating = null,
    friendlinessRating = null,
    professionalismRating = null,
    valueForMoneyRating = null, // For passenger perspective
    respectfulnessRating = null, // For driver perspective on passenger

    // Detailed Feedback
    comment = null,
    compliments = [], // ['punctual', 'friendly', 'safe-driver', 'clean-vehicle', etc.]
    complaints = [], // ['late', 'rude', 'unsafe-driving', 'dirty-vehicle', etc.]
    suggestions = null,

    // Trip Details (cached from booking)
    tripDate,
    tripRoute,
    tripDistance,
    tripDuration,

    // Response
    hasResponse = false,
    responseComment = null,
    responseDate = null,
    respondedBy = null,

    // Verification
    isVerified = false, // Trip completion verified
    verificationMethod = null, // 'auto' | 'manual'
    verifiedAt = null,

    // Moderation
    status = 'active', // 'active' | 'pending_review' | 'hidden' | 'removed'
    moderationReason = null,
    moderatedBy = null,
    moderatedAt = null,
    reportCount = 0,
    reportReasons = [],

    // Display Settings
    isPublic = true,
    isAnonymous = false,
    showOnProfile = true,
    isFeatured = false, // High-quality reviews can be featured

    // Sentiment Analysis
    sentimentScore = null, // -1 to 1 (negative to positive)
    sentimentCategory = null, // 'positive' | 'neutral' | 'negative'
    keywords = [], // Extracted keywords from comment

    // Helpfulness
    helpfulCount = 0,
    unhelpfulCount = 0,
    totalVotes = 0,
    _helpfulnessScore = 0, // Calculated score

    // Badges & Achievements
    badges = [], // ['first-review', 'detailed-feedback', 'constructive-criticism']
    contributionPoints = 0,

    // Edit History
    isEdited = false,
    editCount = 0,
    lastEditedAt = null,
    editHistory = [],

    // Platform Actions
    platformResponse = null,
    actionTaken = null, // 'warning-issued' | 'driver-suspended' | 'passenger-blocked'
    followUpRequired = false,
    followUpNotes = null,

    // Metadata
    deviceType = null, // 'mobile' | 'web' | 'app'
    appVersion = null,
    ipAddress = null,
    location = null,

    // Timestamps
    createdAt = new Date(),
    updatedAt = new Date(),
    publishedAt = null,
    hiddenAt = null,
    removedAt = null,
  }) {
    this.ratingId = ratingId;
    this.bookingId = bookingId;
    this.rideId = rideId;

    // Rater Information
    this.raterId = raterId;
    this.raterType = raterType;
    this.raterName = raterName;

    // Rated Entity Information
    this.ratedId = ratedId;
    this.ratedType = ratedType;
    this.ratedName = ratedName;

    // Rating Scores
    this.overallRating = overallRating;
    this.punctualityRating = punctualityRating;
    this.communicationRating = communicationRating;
    this.vehicleConditionRating = vehicleConditionRating;
    this.drivingSkillRating = drivingSkillRating;
    this.safetyRating = safetyRating;
    this.cleanlinessRating = cleanlinessRating;
    this.friendlinessRating = friendlinessRating;
    this.professionalismRating = professionalismRating;
    this.valueForMoneyRating = valueForMoneyRating;
    this.respectfulnessRating = respectfulnessRating;

    // Calculate average if not provided
    if (!this.overallRating) {
      this.overallRating = this.calculateAverageRating();
    }

    // Detailed Feedback
    this.comment = comment;
    this.compliments = compliments;
    this.complaints = complaints;
    this.suggestions = suggestions;

    // Trip Details
    this.tripDate = tripDate instanceof Date ? tripDate : new Date(tripDate);
    this.tripRoute = tripRoute;
    this.tripDistance = tripDistance;
    this.tripDuration = tripDuration;

    // Response
    this.hasResponse = hasResponse;
    this.responseComment = responseComment;
    this.responseDate = parseDate(responseDate);
    this.respondedBy = respondedBy;

    // Verification
    this.isVerified = isVerified;
    this.verificationMethod = verificationMethod;
    this.verifiedAt = parseDate(verifiedAt);

    // Moderation
    this.status = status;
    this.moderationReason = moderationReason;
    this.moderatedBy = moderatedBy;
    this.moderatedAt = parseDate(moderatedAt);
    this.reportCount = reportCount;
    this.reportReasons = reportReasons;

    // Display Settings
    this.isPublic = isPublic;
    this.isAnonymous = isAnonymous;
    this.showOnProfile = showOnProfile;
    this.isFeatured = isFeatured;

    // Sentiment Analysis
    this.sentimentScore = sentimentScore;
    this.sentimentCategory = sentimentCategory || this.categorizeSentiment();
    this.keywords = keywords;

    // Helpfulness
    this.helpfulCount = helpfulCount;
    this.unhelpfulCount = unhelpfulCount;
    this.totalVotes = totalVotes || helpfulCount + unhelpfulCount;
    this.helpfulnessScore = this.calculateHelpfulnessScore();

    // Badges & Achievements
    this.badges = badges;
    this.contributionPoints = contributionPoints || this.calculateContributionPoints();

    // Edit History
    this.isEdited = isEdited;
    this.editCount = editCount;
    this.lastEditedAt = parseDate(lastEditedAt);
    this.editHistory = editHistory;

    // Platform Actions
    this.platformResponse = platformResponse;
    this.actionTaken = actionTaken;
    this.followUpRequired = followUpRequired;
    this.followUpNotes = followUpNotes;

    // Metadata
    this.deviceType = deviceType;
    this.appVersion = appVersion;
    this.ipAddress = ipAddress;
    this.location = location;

    // Timestamps
    this.createdAt = createdAt instanceof Date ? createdAt : new Date(createdAt);
    this.updatedAt = updatedAt instanceof Date ? updatedAt : new Date(updatedAt);
    this.publishedAt = parseDate(publishedAt);
    this.hiddenAt = parseDate(hiddenAt);
    this.removedAt = parseDate(removedAt);

    // Validate on creation
    this.validate();

    // Auto-analyze if comment provided
    if (this.comment) {
      this.analyzeComment();
    }
  }

  // Getters
  get isActive() {
    return this.status === 'active';
  }

  get isPendingReview() {
    return this.status === 'pending_review';
  }

  get isHidden() {
    return this.status === 'hidden';
  }

  get isRemoved() {
    return this.status === 'removed';
  }

  get isVisible() {
    return this.isActive && this.isPublic && !this.isHidden && !this.isRemoved;
  }

  get isPositive() {
    return this.overallRating >= 4;
  }

  get isNegative() {
    return this.overallRating <= 2;
  }

  get isNeutral() {
    return this.overallRating === 3;
  }

  get hasDetailedFeedback() {
    return this.comment && this.comment.length > 50;
  }

  get isHighQuality() {
    return this.hasDetailedFeedback && this.hasMultipleCriteria() && this.helpfulnessScore > 0.7;
  }

  get needsModeration() {
    return this.reportCount > 2 || this.containsInappropriateContent() || this.overallRating === 1;
  }

  get canBeEdited() {
    const hoursSinceCreation = (new Date() - this.createdAt) / (1000 * 60 * 60);
    return hoursSinceCreation < 24 && this.editCount < 3;
  }

  get canRespond() {
    return !this.hasResponse && this.isActive;
  }

  // Validation
  validate() {
    const errors = [];

    if (!this.ratingId) errors.push('Rating ID is required');
    if (!this.bookingId) errors.push('Booking ID is required');
    if (!this.rideId) errors.push('Ride ID is required');

    // Rater validation
    if (!this.raterId) errors.push('Rater ID is required');
    if (!['passenger', 'driver'].includes(this.raterType)) {
      errors.push('Invalid rater type');
    }

    // Rated entity validation
    if (!this.ratedId) errors.push('Rated ID is required');
    if (!['passenger', 'driver'].includes(this.ratedType)) {
      errors.push('Invalid rated type');
    }

    // Ensure rater and rated are different
    if (this.raterId === this.ratedId) {
      errors.push('Cannot rate yourself');
    }

    // Ensure rater and rated types are opposite
    if (this.raterType === this.ratedType) {
      errors.push('Rater and rated must be of different types');
    }

    // Overall rating validation
    if (!this.overallRating || !isInRange(this.overallRating, 1, 5)) {
      errors.push('Overall rating must be between 1 and 5');
    }

    // Validate individual ratings if provided
    const ratingFields = [
      'punctualityRating',
      'communicationRating',
      'vehicleConditionRating',
      'drivingSkillRating',
      'safetyRating',
      'cleanlinessRating',
      'friendlinessRating',
      'professionalismRating',
      'valueForMoneyRating',
      'respectfulnessRating',
    ];

    ratingFields.forEach((field) => {
      if (this[field] !== null && !isInRange(this[field], 1, 5)) {
        errors.push(`${field} must be between 1 and 5`);
      }
    });

    // Comment length validation
    if (this.comment && this.comment.length > 1000) {
      errors.push('Comment cannot exceed 1000 characters');
    }

    // Status validation
    const validStatuses = ['active', 'pending_review', 'hidden', 'removed'];
    if (!validStatuses.includes(this.status)) {
      errors.push('Invalid rating status');
    }

    // Trip date validation
    if (!this.tripDate) {
      errors.push('Trip date is required');
    }

    // Cannot rate future trips
    if (this.tripDate > new Date()) {
      errors.push('Cannot rate future trips');
    }

    // Cannot rate very old trips (> 30 days)
    const daysSinceTrip = (new Date() - this.tripDate) / (1000 * 60 * 60 * 24);
    if (daysSinceTrip > 30) {
      errors.push('Cannot rate trips older than 30 days');
    }

    if (errors.length > 0) {
      throw new Error(`Rating validation failed: ${errors.join(', ')}`);
    }

    return true;
  }

  // Rating Calculation
  calculateAverageRating() {
    const ratings = [
      this.punctualityRating,
      this.communicationRating,
      this.vehicleConditionRating,
      this.drivingSkillRating,
      this.safetyRating,
      this.cleanlinessRating,
      this.friendlinessRating,
      this.professionalismRating,
      this.valueForMoneyRating,
      this.respectfulnessRating,
    ].filter((r) => r !== null);

    if (ratings.length === 0) {
      return this.overallRating || 0;
    }

    const sum = ratings.reduce((acc, rating) => acc + rating, 0);
    return parseFloat((sum / ratings.length).toFixed(1));
  }

  hasMultipleCriteria() {
    const criteriaCount = [
      this.punctualityRating,
      this.communicationRating,
      this.vehicleConditionRating,
      this.drivingSkillRating,
      this.safetyRating,
      this.cleanlinessRating,
      this.friendlinessRating,
      this.professionalismRating,
      this.valueForMoneyRating,
      this.respectfulnessRating,
    ].filter((r) => r !== null).length;

    return criteriaCount >= 3;
  }

  // Sentiment Analysis
  analyzeComment() {
    if (!this.comment) return;

    const positiveWords = [
      'excellent',
      'great',
      'wonderful',
      'amazing',
      'perfect',
      'best',
      'friendly',
      'professional',
      'punctual',
      'clean',
      'safe',
      'comfortable',
      'reliable',
      'helpful',
      'courteous',
      'pleasant',
      'smooth',
      'efficient',
    ];

    const negativeWords = [
      'terrible',
      'horrible',
      'worst',
      'bad',
      'poor',
      'disappointing',
      'rude',
      'unprofessional',
      'late',
      'dirty',
      'dangerous',
      'uncomfortable',
      'unreliable',
      'unfriendly',
      'rough',
      'inefficient',
      'waste',
      'never',
    ];

    const commentLower = this.comment.toLowerCase();

    // Count positive and negative words
    const foundKeywords = [];

    const positiveCount = positiveWords.filter((word) => {
      if (commentLower.includes(word)) {
        foundKeywords.push(word);
        return true;
      }
      return false;
    }).length;

    const negativeCount = negativeWords.filter((word) => {
      if (commentLower.includes(word)) {
        foundKeywords.push(word);
        return true;
      }
      return false;
    }).length;

    // Calculate sentiment score
    const total = positiveCount + negativeCount;
    if (total > 0) {
      this.sentimentScore = (positiveCount - negativeCount) / total;
    } else {
      // Use overall rating as fallback
      this.sentimentScore = (this.overallRating - 3) / 2;
    }

    this.keywords = foundKeywords;
    this.sentimentCategory = this.categorizeSentiment();
  }

  categorizeSentiment() {
    if (this.sentimentScore > 0.3) {
      return 'positive';
    }
    if (this.sentimentScore < -0.3) {
      return 'negative';
    }
    return 'neutral';
  }

  containsInappropriateContent() {
    if (!this.comment) return false;

    const inappropriateWords = [
      'abuse',
      'harassment',
      'threat',
      'violence',
      'discrimination',
      'hate',
      'assault',
      'attack',
    ];

    const commentLower = this.comment.toLowerCase();

    return inappropriateWords.some((word) => commentLower.includes(word));
  }

  // Helpfulness
  calculateHelpfulnessScore() {
    if (this.totalVotes === 0) return 0;

    // Wilson score interval for ranking
    const positive = this.helpfulCount;
    const total = this.totalVotes;

    if (total === 0) return 0;

    const z = 1.96; // 95% confidence
    const phat = positive / total;

    const score =
      (phat +
        (z * z) / (2 * total) -
        z * Math.sqrt((phat * (1 - phat) + (z * z) / (4 * total)) / total)) /
      (1 + (z * z) / total);

    return parseFloat(score.toFixed(3));
  }

  voteHelpful() {
    this.helpfulCount += 1;
    this.totalVotes += 1;
    this.helpfulnessScore = this.calculateHelpfulnessScore();
    this.updatedAt = new Date();

    return {
      helpfulCount: this.helpfulCount,
      totalVotes: this.totalVotes,
      score: this.helpfulnessScore,
    };
  }

  voteUnhelpful() {
    this.unhelpfulCount += 1;
    this.totalVotes += 1;
    this.helpfulnessScore = this.calculateHelpfulnessScore();
    this.updatedAt = new Date();

    return {
      unhelpfulCount: this.unhelpfulCount,
      totalVotes: this.totalVotes,
      score: this.helpfulnessScore,
    };
  }

  // Contribution Points
  calculateContributionPoints() {
    let points = 0;

    // Base points for rating
    points += 10;

    // Bonus for detailed feedback
    if (this.comment) {
      if (this.comment.length > 20) points += 5;
      if (this.comment.length > 50) points += 10;
      if (this.comment.length > 100) points += 15;
    }

    // Bonus for multiple criteria
    if (this.hasMultipleCriteria()) {
      points += 10;
    }

    // Bonus for compliments/complaints
    points += this.compliments.length * 2;
    points += this.complaints.length * 2;

    // Bonus for suggestions
    if (this.suggestions) {
      points += 15;
    }

    // Bonus for being helpful
    points += this.helpfulCount * 5;

    // Penalty for being unhelpful
    points -= this.unhelpfulCount * 2;

    return Math.max(0, points);
  }

  // Edit Management
  edit(updates) {
    if (!this.canBeEdited) {
      throw new Error('Rating can no longer be edited');
    }

    // Store current state in history
    this.editHistory.push({
      editedAt: new Date(),
      previousState: {
        overallRating: this.overallRating,
        comment: this.comment,
        compliments: [...this.compliments],
        complaints: [...this.complaints],
      },
    });

    // Apply updates
    const allowedUpdates = [
      'overallRating',
      'comment',
      'compliments',
      'complaints',
      'punctualityRating',
      'communicationRating',
      'vehicleConditionRating',
      'drivingSkillRating',
      'safetyRating',
      'cleanlinessRating',
      'friendlinessRating',
      'professionalismRating',
      'valueForMoneyRating',
      'respectfulnessRating',
      'suggestions',
    ];

    Object.keys(updates).forEach((key) => {
      if (allowedUpdates.includes(key)) {
        this[key] = updates[key];
      }
    });

    // Recalculate ratings
    if (!updates.overallRating) {
      this.overallRating = this.calculateAverageRating();
    }

    // Re-analyze comment if changed
    if (updates.comment) {
      this.analyzeComment();
    }

    this.isEdited = true;
    this.editCount += 1;
    this.lastEditedAt = new Date();
    this.updatedAt = new Date();

    // Re-validate
    this.validate();

    return true;
  }

  // Response Management
  addResponse(responseComment, responderId) {
    if (!this.canRespond) {
      throw new Error('Cannot add response to this rating');
    }

    if (!responseComment || responseComment.length < 10) {
      throw new Error('Response must be at least 10 characters');
    }

    if (responseComment.length > 500) {
      throw new Error('Response cannot exceed 500 characters');
    }

    this.hasResponse = true;
    this.responseComment = responseComment;
    this.responseDate = new Date();
    this.respondedBy = responderId;
    this.updatedAt = new Date();

    return true;
  }

  // Moderation
  report(reason, reporterId) {
    const validReasons = [
      'inappropriate',
      'spam',
      'harassment',
      'false-information',
      'privacy-violation',
      'other',
    ];

    if (!validReasons.includes(reason)) {
      throw new Error('Invalid report reason');
    }

    this.reportCount += 1;
    this.reportReasons.push({
      reason,
      reporterId,
      reportedAt: new Date(),
    });

    // Auto-flag for review if threshold reached
    if (this.reportCount >= 3) {
      this.status = 'pending_review';
      this.followUpRequired = true;
    }

    this.updatedAt = new Date();

    return {
      reportCount: this.reportCount,
      needsReview: this.needsModeration,
    };
  }

  moderate(action, moderatorId, reason) {
    const validActions = ['approve', 'hide', 'remove', 'edit'];

    if (!validActions.includes(action)) {
      throw new Error('Invalid moderation action');
    }

    switch (action) {
      case 'approve':
        this.status = 'active';
        break;
      case 'hide':
        this.status = 'hidden';
        this.hiddenAt = new Date();
        break;
      case 'remove':
        this.status = 'removed';
        this.removedAt = new Date();
        break;
      default:
        throw new Error('None');
    }

    this.moderationReason = reason;
    this.moderatedBy = moderatorId;
    this.moderatedAt = new Date();
    this.updatedAt = new Date();

    return true;
  }

  // Feature Management
  feature() {
    if (!this.isHighQuality) {
      throw new Error('Only high-quality ratings can be featured');
    }

    this.isFeatured = true;
    this.badges.push('featured-review');
    this.contributionPoints += 50;
    this.updatedAt = new Date();

    return true;
  }

  unfeature() {
    this.isFeatured = false;
    this.badges = this.badges.filter((b) => b !== 'featured-review');
    this.updatedAt = new Date();

    return true;
  }

  // Badge Management
  awardBadge(badge) {
    const validBadges = [
      'first-review',
      'detailed-feedback',
      'helpful-reviewer',
      'top-contributor',
      'constructive-critic',
      'verified-rider',
      'safety-champion',
      'community-builder',
    ];

    if (!validBadges.includes(badge)) {
      throw new Error('Invalid badge');
    }

    if (!this.badges.includes(badge)) {
      this.badges.push(badge);
      this.contributionPoints += 20;
      this.updatedAt = new Date();
    }

    return this.badges;
  }

  // Anonymization
  makeAnonymous() {
    this.isAnonymous = true;
    this.updatedAt = new Date();

    return true;
  }

  removeAnonymity() {
    this.isAnonymous = false;
    this.updatedAt = new Date();

    return true;
  }

  // Display Name
  getDisplayName() {
    if (this.isAnonymous) {
      return this.raterType === 'passenger' ? 'Anonymous Passenger' : 'Anonymous Driver';
    }
    return this.raterName;
  }

  // Summary Generation
  generateSummary() {
    const aspects = [];

    if (this.punctualityRating >= 4) aspects.push('punctual');
    if (this.safetyRating >= 4) aspects.push('safe');
    if (this.cleanlinessRating >= 4) aspects.push('clean');
    if (this.friendlinessRating >= 4) aspects.push('friendly');
    if (this.professionalismRating >= 4) aspects.push('professional');

    const issues = [];

    if (this.punctualityRating <= 2) issues.push('punctuality issues');
    if (this.safetyRating <= 2) issues.push('safety concerns');
    if (this.cleanlinessRating <= 2) issues.push('cleanliness issues');

    return {
      overall: this.overallRating,
      sentiment: this.sentimentCategory,
      positiveAspects: aspects,
      negativeAspects: issues,
      wouldRecommend: this.overallRating >= 4,
    };
  }

  // Serialization
  toJSON() {
    return {
      ratingId: this.ratingId,
      bookingId: this.bookingId,
      rideId: this.rideId,

      // Rater
      raterId: this.raterId,
      raterType: this.raterType,
      raterName: this.getDisplayName(),

      // Rated
      ratedId: this.ratedId,
      ratedType: this.ratedType,
      ratedName: this.ratedName,

      // Ratings
      overallRating: this.overallRating,
      detailedRatings: {
        punctuality: this.punctualityRating,
        communication: this.communicationRating,
        vehicleCondition: this.vehicleConditionRating,
        drivingSkill: this.drivingSkillRating,
        safety: this.safetyRating,
        cleanliness: this.cleanlinessRating,
        friendliness: this.friendlinessRating,
        professionalism: this.professionalismRating,
        valueForMoney: this.valueForMoneyRating,
        respectfulness: this.respectfulnessRating,
      },

      // Feedback
      comment: this.comment,
      compliments: this.compliments,
      complaints: this.complaints,
      suggestions: this.suggestions,

      // Trip Info
      tripDate: this.tripDate.toISOString(),
      tripRoute: this.tripRoute,

      // Response
      hasResponse: this.hasResponse,
      responseComment: this.responseComment,
      responseDate: this.responseDate ? this.responseDate.toISOString() : null,

      // Status
      status: this.status,
      isVisible: this.isVisible,
      isVerified: this.isVerified,
      isAnonymous: this.isAnonymous,
      isFeatured: this.isFeatured,

      // Quality Indicators
      isPositive: this.isPositive,
      isNegative: this.isNegative,
      hasDetailedFeedback: this.hasDetailedFeedback,
      isHighQuality: this.isHighQuality,

      // Sentiment
      sentimentCategory: this.sentimentCategory,
      sentimentScore: this.sentimentScore,
      keywords: this.keywords,

      // Helpfulness
      helpfulCount: this.helpfulCount,
      unhelpfulCount: this.unhelpfulCount,
      helpfulnessScore: this.helpfulnessScore,

      // Achievements
      badges: this.badges,
      contributionPoints: this.contributionPoints,

      // Edit Info
      isEdited: this.isEdited,
      editCount: this.editCount,
      canBeEdited: this.canBeEdited,

      // Summary
      summary: this.generateSummary(),

      // Timestamps
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
      publishedAt: this.publishedAt ? this.publishedAt.toISOString() : null,
      lastEditedAt: this.lastEditedAt ? this.lastEditedAt.toISOString() : null,
    };
  }

  // Factory method
  static fromDatabase(data) {
    return new Rating({
      ...data,
      tripDate: new Date(data.tripDate),
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
      publishedAt: data.publishedAt ? new Date(data.publishedAt) : null,
      hiddenAt: data.hiddenAt ? new Date(data.hiddenAt) : null,
      removedAt: data.removedAt ? new Date(data.removedAt) : null,
      responseDate: data.responseDate ? new Date(data.responseDate) : null,
      verifiedAt: data.verifiedAt ? new Date(data.verifiedAt) : null,
      moderatedAt: data.moderatedAt ? new Date(data.moderatedAt) : null,
      lastEditedAt: data.lastEditedAt ? new Date(data.lastEditedAt) : null,
    });
  }
}

module.exports = Rating;
