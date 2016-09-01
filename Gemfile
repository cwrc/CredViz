source 'https://rubygems.org'

# === Face: Web ===
gem 'sass', require: 'sass'
gem 'uglifier'
gem 'therubyracer'
gem 'erubis' # To be able to render ERB
gem 'tilt', '~>1.4'
gem 'sinatra'
gem 'sinatra-contrib'
# gem 'padrino-helpers'
gem 'sinatra-partial'
gem 'sinatra-asset-pipeline'
gem 'sinatra-bouncer'
gem 'rack-protection' # to prevent cross-site scripting and other attacks
gem 'warden'
gem 'rack-parser', :require => 'rack/parser'
gem 'bcrypt'

# === Core ===
gem 'rake'
gem 'activesupport'

# === Persist ===
# - none -

group :development do
   gem 'ruby-prof'
end

group :test do
   # gem 'database_cleaner'
   gem 'rspec', '~> 3.4'
   gem 'cucumber', '~> 1.3.20'
   gem 'capybara'
   gem 'launchy'

   gem 'simplecov'

   gem 'poltergeist'

   # gem 'timecop'

   gem 'parallel_tests'

   # gem 'fakefs'
end